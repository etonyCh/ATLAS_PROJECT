"""
@file ATLAS-OCR/src/infrastructure/llm/ollama_client.py
@description Dedicated client for local Ollama integration with automatic model pulling.
@layer Infrastructure
"""

import asyncio
import logging
import os
import aiohttp
from typing import AsyncGenerator, Optional, List

logger = logging.getLogger(__name__)

# Default local models optimized for i5 + 8GB VRAM (RTX 4060)
DEFAULT_LLM_MODEL = "llama3.2:latest"
DEFAULT_VLM_MODEL = "llama3.2-vision:latest"
DEFAULT_EMBED_MODEL = "nomic-embed-text:latest"

class OllamaClient:
    _url_cache: Optional[str] = None
    _pulling_lock = asyncio.Lock()

    @classmethod
    async def get_url(cls) -> str:
        """
        Auto-detect the active Ollama API URL.
        Inside docker container on Linux/macOS, tries environment variables,
        then custom proxy/gateway candidates, then defaults.
        """
        if cls._url_cache:
            return cls._url_cache

        # Support explicit environment configuration
        env_url = os.getenv("OLLAMA_URL") or os.getenv("OLLAMA_HOST")
        if env_url:
            if not env_url.startswith("http"):
                env_url = f"http://{env_url}"
            env_url = env_url.rstrip("/")
            cls._url_cache = env_url
            logger.info(f"[OLLAMA] Using configured Ollama URL from environment: {env_url}")
            return env_url

        candidates = [
            "http://host.docker.internal:11435", # SOTA Host-network proxy
            "http://host.docker.internal:11434",
            "http://172.19.0.1:11435",           # bridge gateway proxy
            "http://172.19.0.1:11434",           # bridge gateway direct
            "http://172.17.0.1:11435",           # docker0 gateway proxy
            "http://172.17.0.1:11434",           # docker0 gateway direct
            "http://localhost:11434",
            "http://127.0.0.1:11434"
        ]

        for base_url in candidates:
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(f"{base_url}/api/tags", timeout=1.0) as res:
                        if res.status == 200:
                            cls._url_cache = base_url
                            logger.info(f"[OLLAMA] Auto-detected active Ollama instance at: {base_url}")
                            return base_url
            except Exception:
                continue

        # Default fallback
        logger.warning("[OLLAMA] No active Ollama instance detected. Defaulting to host.docker.internal.")
        return "http://host.docker.internal:11434"

    @classmethod
    async def ensure_model(cls, model_name: str) -> None:
        """
        Checks if the requested model is pulled. If not, pulls it and blocks until complete.
        Guarded with a class lock to prevent concurrent redundant pulls.
        """
        base_url = await cls.get_url()
        async with cls._pulling_lock:
            # 1. Check if model exists
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(f"{base_url}/api/tags") as res:
                        res.raise_for_status()
                        data = await res.json()
                        existing_models = [m["name"] for m in data.get("models", [])]
                        
                        # Support checking with or without tag (e.g. llama3.2 vs llama3.2:latest)
                        normalized_existing = set()
                        for m in existing_models:
                            normalized_existing.add(m)
                            if ":" in m:
                                normalized_existing.add(m.split(":")[0])
                                
                        req_base = model_name.split(":")[0] if ":" in model_name else model_name
                        if (model_name in normalized_existing or 
                            f"{model_name}:latest" in normalized_existing or 
                            req_base in normalized_existing):
                            return
            except Exception as e:
                logger.error(f"[OLLAMA] Error listing local models: {e}")
                # Try to proceed to pull anyway in case API is active but tag query failed

            # 2. Pull the model
            logger.info(f"[OLLAMA] 📥 Model '{model_name}' not found locally. Initiating automatic pull...")
            try:
                # 60-minute timeout for large downloads
                timeout = aiohttp.ClientTimeout(total=3600.0, sock_read=300.0)
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    payload = {"name": model_name, "stream": True}
                    async with session.post(f"{base_url}/api/pull", json=payload) as res:
                        res.raise_for_status()
                        async for line in res.content:
                            if line:
                                import json
                                try:
                                    status_data = json.loads(line.decode('utf-8'))
                                    if "error" in status_data:
                                        raise RuntimeError(status_data["error"])
                                    status = status_data.get("status", "")
                                    completed = status_data.get("completed", 0)
                                    total = status_data.get("total", 0)
                                    if total > 0:
                                        pct = (completed / total) * 100
                                        logger.info(f"[OLLAMA][PULL][{model_name}] {status}: {pct:.1f}%")
                                    else:
                                        logger.info(f"[OLLAMA][PULL][{model_name}] {status}")
                                except ValueError:
                                    continue

                        # Verify model registration
                        async with session.get(f"{base_url}/api/tags") as check_res:
                            check_res.raise_for_status()
                            check_data = await check_res.json()
                            existing_models = [m["name"] for m in check_data.get("models", [])]
                            normalized_existing = set()
                            for m in existing_models:
                                normalized_existing.add(m)
                                if ":" in m:
                                    normalized_existing.add(m.split(":")[0])
                            
                            req_base = model_name.split(":")[0] if ":" in model_name else model_name
                            if not (model_name in normalized_existing or 
                                    f"{model_name}:latest" in normalized_existing or 
                                    req_base in normalized_existing):
                                raise RuntimeError("Model not present in Ollama registry after pull stream finished.")

                        logger.info(f"[OLLAMA] ✅ Successfully pulled local model: '{model_name}'")
            except Exception as e:
                logger.error(f"[OLLAMA] ❌ Failed to pull local model '{model_name}': {e}")
                raise RuntimeError(f"Ollama pull failed for model '{model_name}': {e}")

    @classmethod
    async def generate(
        cls,
        prompt: str,
        system_instruction: str = "",
        max_tokens: int = 2048,
        image_base64: Optional[str] = None,
        model_name: Optional[str] = None
    ) -> str:
        """
        Verbatim text generation (with optional Vision OCR support).
        """
        # Determine model
        is_vision = image_base64 is not None
        default_model = DEFAULT_VLM_MODEL if is_vision else DEFAULT_LLM_MODEL
        active_model = model_name or default_model

        # Ensure model is pulled
        await cls.ensure_model(active_model)

        base_url = await cls.get_url()
        payload = {
            "model": active_model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.1,
                "num_predict": max_tokens
            }
        }
        if system_instruction:
            payload["system"] = system_instruction
        if image_base64:
            payload["images"] = [image_base64]

        # VLM payloads can be massive, set a 5-minute timeout for local generation
        timeout = aiohttp.ClientTimeout(total=300.0)
        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(f"{base_url}/api/generate", json=payload) as res:
                    res.raise_for_status()
                    data = await res.json()
                    return data.get("response", "").strip()
        except Exception as e:
            logger.error(f"[OLLAMA] Generation failed for model '{active_model}': {e}")
            raise ConnectionError(f"Ollama local error: {e}")

    @classmethod
    async def generate_stream(
        cls,
        prompt: str,
        system_instruction: str = "",
        max_tokens: int = 2048,
        model_name: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """
        Streaming text generation for chat or synthesis.
        """
        active_model = model_name or DEFAULT_LLM_MODEL
        await cls.ensure_model(active_model)

        base_url = await cls.get_url()
        payload = {
            "model": active_model,
            "prompt": prompt,
            "stream": True,
            "options": {
                "temperature": 0.2,
                "num_predict": max_tokens
            }
        }
        if system_instruction:
            payload["system"] = system_instruction

        timeout = aiohttp.ClientTimeout(total=600.0, sock_read=60.0)
        try:
            session = aiohttp.ClientSession(timeout=timeout)
            try:
                async with session.post(f"{base_url}/api/generate", json=payload) as res:
                    res.raise_for_status()
                    async for line in res.content:
                        if line:
                            import json
                            try:
                                data = json.loads(line.decode('utf-8'))
                                chunk = data.get("response", "")
                                if chunk:
                                    yield chunk
                            except ValueError:
                                continue
            finally:
                await session.close()
        except Exception as e:
            logger.error(f"[OLLAMA] Streaming failed for model '{active_model}': {e}")
            raise ConnectionError(f"Ollama local stream error: {e}")

    @classmethod
    async def embed(cls, texts: List[str], model_name: Optional[str] = None) -> List[List[float]]:
        """
        Generates batch embeddings via Ollama's /api/embed API endpoint.
        """
        if not texts:
            return []

        active_model = model_name or DEFAULT_EMBED_MODEL
        await cls.ensure_model(active_model)

        base_url = await cls.get_url()
        payload = {
            "model": active_model,
            "input": texts
        }

        timeout = aiohttp.ClientTimeout(total=120.0)
        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(f"{base_url}/api/embed", json=payload) as res:
                    res.raise_for_status()
                    data = await res.json()
                    return data.get("embeddings", [])
        except Exception as e:
            # Fallback to older /api/embeddings in a loop if /api/embed failed
            logger.warning(f"[OLLAMA] /api/embed failed, attempting fallback to loop of /api/embeddings: {e}")
            embeddings = []
            async with aiohttp.ClientSession(timeout=timeout) as session:
                for text in texts:
                    try:
                        async with session.post(
                            f"{base_url}/api/embeddings",
                            json={"model": active_model, "prompt": text}
                        ) as res:
                            res.raise_for_status()
                            data = await res.json()
                            embeddings.append(data.get("embedding", []))
                    except Exception as inner_e:
                        logger.error(f"[OLLAMA] Embedding failed for individual text: {inner_e}")
                        raise ConnectionError(f"Ollama local embedding error: {inner_e}")
            return embeddings
