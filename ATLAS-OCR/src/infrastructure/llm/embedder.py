"""
@file ATLAS-OCR/src/infrastructure/llm/embedder.py
@description Sovereign Edge Embedding Service.
@layer Infrastructure

[OMNI-ARCHITECT SOTA FIX]: 
Converted from CPUEmbedderService to SovereignEmbedderService.
Respects Domain-Driven Design (DDD) by isolating the HTTP transport layer 
away from the bridge facade. Zero local model execution.
"""

import os
import logging
import httpx
import numpy as np
import asyncio
from typing import List

from infrastructure.config_manager import OmniConfig

logger = logging.getLogger(__name__)

class SovereignEmbedderService:
    """
    Acts as a local embedder for the RAG framework, but proxies all tensor math 
    to the Sovereign Edge (Kaggle) via the Cloudflare tunnel.
    """
    def __init__(self, config: OmniConfig):
        self.config = config
        self.tunnel_url = os.getenv("COLAB_GPU_URL", "").rstrip("/")
        self.api_key = os.getenv("TUNNEL_API_KEY", "omni_colab_secret_123")
        
        if not self.tunnel_url:
            logger.warning("[EMBEDDER] COLAB_GPU_URL is missing. Embeddings will fail until configured.")
        else:
            logger.info(f"[EMBEDDER] Sovereign Embedder initialized. Routing to: {self.tunnel_url}")

    async def embed(self, texts: List[str]) -> List[np.ndarray]:
        """
        Pipes text chunks to Kaggle and returns multi-vector numpy arrays.
        """
        if not texts:
            return []
            
        try:
            if not self.tunnel_url:
                raise RuntimeError("Sovereign Edge Tunnel URL not configured in environment.")

            payload = {"texts": texts}
            headers = {"X-API-Key": self.api_key} if self.api_key else {}

            # 120s timeout to survive Kaggle T4 heavy batches during ingestion
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.tunnel_url}/embed", 
                    json=payload, 
                    headers=headers
                )
                response.raise_for_status()
                data = response.json()
                
                # Kaggle returns {"vectors": [ [float, float...], [...] ]}
                return [np.array(vec, dtype=np.float32) for vec in data.get("vectors", [])]
                
        except (httpx.HTTPError, RuntimeError) as e:
            logger.warning(f"[EMBEDDER] Sovereign Edge connection failed: {e}. Falling back to local CPU FastEmbed ColBERT...")
            try:
                from fastembed import LateInteractionTextEmbedding
                if not hasattr(self, "_local_embedder"):
                    logger.info("[EMBEDDER] Loading local LateInteractionTextEmbedding(jinaai/jina-colbert-v2)...")
                    cache_dir = os.getenv("HF_HOME", "/omni/cache/huggingface")
                    self._local_embedder = LateInteractionTextEmbedding(
                        "jinaai/jina-colbert-v2",
                        cache_dir=cache_dir,
                        threads=int(os.getenv("FASTEMBED_THREADS", "4"))
                    )
                vectors = await asyncio.to_thread(list, self._local_embedder.embed(texts))
                return [np.array(vec, dtype=np.float32) for vec in vectors]

            except Exception as fastembed_exc:
                logger.error(f"[EMBEDDER] Local FastEmbed fallback failed: {fastembed_exc}")
                raise RuntimeError(
                    f"Could not reach Kaggle tunnel for vector embeddings: {e}. "
                    f"Local FastEmbed fallback also failed: {fastembed_exc}"
                ) from e