import logging
import time
import httpx
from typing import List, Optional, Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)

class OllamaInferenceError(Exception):
    """Custom exception raised when Ollama fails to respond after maximum retries."""
    pass

class OllamaClient:
    """
    SOTA Modular HTTP Client for Ollama.
    Strictly decoupled from business logic to act as a "Lego" engine.
    Handles both standard text generation and multimodal (vision) payloads.
    """
    
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        self.timeout = settings.OLLAMA_TIMEOUT_SECONDS
        self.max_retries = settings.OLLAMA_MAX_RETRIES
        self._tags_cache_time: float = 0.0
        self._tags_cache_names: list[str] | None = None
        self._tags_cache_ttl: float = 60.0
        
        # DEFENSIVE ARCHITECTURE: Enforce strict connection pooling limits
        # Prevents port exhaustion during high-concurrency Celery OCR bursts.
        self.client_limits = httpx.Limits(max_keepalive_connections=5, max_connections=20)

    def _fetch_ollama_model_names(self) -> list[str]:
        """List models from Ollama (cached briefly). Used to align config names with registry."""
        now = time.time()
        if self._tags_cache_names is not None and (now - self._tags_cache_time) < self._tags_cache_ttl:
            return self._tags_cache_names
        try:
            with httpx.Client(timeout=10.0, limits=self.client_limits) as client:
                r = client.get(f"{self.base_url}/api/tags")
                r.raise_for_status()
                data = r.json()
                raw = data.get("models") or []
                names = []
                for m in raw:
                    if not isinstance(m, dict):
                        continue
                    n = (m.get("name") or m.get("model") or "").strip()
                    if n:
                        names.append(n)
        except Exception as e:
            logger.warning("[OLLAMA] Could not list models from /api/tags: %s", e)
            return []
        self._tags_cache_time = now
        self._tags_cache_names = names
        return names

    def invalidate_model_list_cache(self) -> None:
        """Clear /api/tags cache (e.g. after pull or a stale registry mismatch)."""
        self._tags_cache_names = None
        self._tags_cache_time = 0.0

    @staticmethod
    def _model_short_name(model_name: str) -> str:
        """Base id without tag, last path segment only (namespace-independent)."""
        base = model_name.rsplit(":", 1)[0] if ":" in model_name else model_name
        return base.split("/")[-1]

    def _resolve_model_name(self, requested: str) -> str:
        """
        Map OLLAMA_MODEL_* to the exact string Ollama registered (e.g. minicpm-v4:latest
        vs openbmb/minicpm-v4). A 404 on /api/generate usually means this mismatch on Linux/macOS.
        """
        requested = (requested or "").strip()
        if not requested:
            return requested
        names = self._fetch_ollama_model_names()
        if not names:
            logger.warning(
                "[OLLAMA] /api/tags returned no models; using configured name as-is: %s",
                requested,
            )
            return requested
        if requested in names:
            return requested
        req_short = self._model_short_name(requested).lower()
        for n in names:
            if self._model_short_name(n).lower() == req_short:
                logger.info("[OLLAMA] Resolved model '%s' -> '%s'", requested, n)
                return n
        logger.warning(
            "[OLLAMA] No registry match for '%s' (short=%s). Known models: %s",
            requested,
            req_short,
            ", ".join(names[:25]) + ("…" if len(names) > 25 else ""),
        )
        return requested

    def _vision_model_fallback_ids(self, tried: str) -> List[str]:
        """Alternate ids to try when Ollama rejects the vision model name (404)."""
        short = self._model_short_name(tried)
        alts: List[str] = []
        for c in (short, f"{short}:latest"):
            if c and c != tried and c not in alts:
                alts.append(c)
        return alts

    def _post_with_retries(self, endpoint: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Internal execution engine with exponential backoff and strict timeout adherence.
        """
        url = f"{self.base_url}{endpoint}"
        attempt = 0
        last_exception = None

        # httpx Client context ensures connections are properly recycled
        with httpx.Client(timeout=self.timeout, limits=self.client_limits) as client:
            while attempt < self.max_retries:
                try:
                    logger.info(f"[OLLAMA] Dispatching payload to {payload.get('model')} (Attempt {attempt + 1}/{self.max_retries})")
                    
                    response = client.post(url, json=payload)
                    response.raise_for_status()
                    
                    logger.info(f"[OLLAMA] Successful inference from {payload.get('model')}")
                    return response.json()
                    
                except httpx.TimeoutException as e:
                    logger.warning(f"[OLLAMA] Timeout on attempt {attempt + 1}: {str(e)}")
                    last_exception = e
                except httpx.HTTPStatusError as e:
                    logger.error(f"[OLLAMA] HTTP Error {e.response.status_code}: {e.response.text}")
                    last_exception = e
                    # Fast-fail on 4xx errors (e.g., model not found), as retrying won't fix bad requests
                    if 400 <= e.response.status_code < 500:
                        break
                except httpx.RequestError as e:
                    logger.warning(f"[OLLAMA] Network disruption on attempt {attempt + 1}: {str(e)}")
                    last_exception = e
                
                attempt += 1
                if attempt < self.max_retries:
                    backoff_time = 2 ** attempt  # Exponential backoff: 2s, 4s, 8s...
                    logger.debug(f"[OLLAMA] Sleeping for {backoff_time}s before retry...")
                    time.sleep(backoff_time)
        
        # Total failure threshold reached
        error_msg = f"Ollama API completely failed after {self.max_retries} attempts. Last exception: {str(last_exception)}"
        logger.critical(error_msg)
        raise OllamaInferenceError(error_msg)

    def generate_text(self, prompt: str, model: Optional[str] = None, system: Optional[str] = None) -> str:
        """
        Standard text generation pipeline.
        Defaults to settings.OLLAMA_MODEL_RAG (e.g., qwen) if no model is explicitly passed.
        """
        target_model = self._resolve_model_name(model or settings.OLLAMA_MODEL_RAG)
        
        payload = {
            "model": target_model,
            "prompt": prompt,
            "stream": False
        }
        if system:
            payload["system"] = system

        response_data = self._post_with_retries("/api/generate", payload)
        return response_data.get("response", "")

    def generate_vision(self, prompt: str, base64_images: List[str], model: Optional[str] = None) -> str:
        """
        Multimodal OCR pipeline.
        Defaults to settings.OLLAMA_MODEL_VISION (e.g., minicpm-v4).
        """
        # Defensive Input Validation
        if not base64_images or not isinstance(base64_images, list):
            raise ValueError("CRITICAL: Vision model requires a valid list of base64 encoded images.")

        requested = (model or settings.OLLAMA_MODEL_VISION).strip()
        target_model = self._resolve_model_name(requested)
        payload: Dict[str, Any] = {
            "model": target_model,
            "prompt": prompt,
            "images": base64_images,
            "stream": False,
        }

        try:
            response_data = self._post_with_retries("/api/generate", payload)
            return response_data.get("response", "")
        except OllamaInferenceError:
            # Tags can disagree with the runner (namespace in list but generate wants short id).
            self.invalidate_model_list_cache()
            for alt in self._vision_model_fallback_ids(target_model):
                logger.info(
                    "[OLLAMA] Retrying vision OCR with alternate model id after failure: %s",
                    alt,
                )
                payload["model"] = alt
                try:
                    response_data = self._post_with_retries("/api/generate", payload)
                    return response_data.get("response", "")
                except OllamaInferenceError:
                    continue
            raise

# Instantiate the singleton for application-wide use
ollama = OllamaClient()