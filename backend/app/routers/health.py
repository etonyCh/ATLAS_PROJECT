from __future__ import annotations

import time
import logging

from fastapi import APIRouter, Request

from app.core.qdrant_client import get_qdrant_manager

router = APIRouter(tags=["Health"])
logger = logging.getLogger(__name__)


@router.get("/health")
async def health_check(request: Request) -> dict[str, object]:
    started = time.perf_counter()

    services = {
        "db": "ok",
        "redis": "ok",
        "qdrant": "ok",
        "storage": "ok",
    }

    if not hasattr(request.app.state, "redis"):
        services["redis"] = "degraded"
    if not hasattr(request.app.state, "redis_cache"):
        services["redis"] = "degraded"

    # Check Qdrant connectivity
    try:
        qdrant = get_qdrant_manager()
        client = qdrant.get_client()
        # Quick health check by listing collections
        client.get_collections()
    except Exception as e:
        services["qdrant"] = "degraded"
        logger.warning(f"[HEALTH] Qdrant connectivity check failed: {e}")

    latency_ms = round((time.perf_counter() - started) * 1000, 2)

    return {
        "status": "ok" if all(value == "ok" for value in services.values()) else "degraded",
        "services": services,
        "latency_ms": latency_ms,
    }
