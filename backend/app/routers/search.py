from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.exceptions import atlas_error
from app.core.limits import limiter
from app.db.session import get_session
from app.services.ai_core.rag_inference import execute_hybrid_search, meili_client
from app.models.contribution import Contribution, DocumentVersion
from app.models.user import User
from app.dependencies import get_current_user


router = APIRouter(tags=["Search"])


class SearchResultItem(BaseModel):
    document_version_id: str
    course_id: str | None = None
    title: str
    teacher_name: str | None = None
    is_official: bool = False
    quality_score: float | None = 0.0
    snippet: str
    tags: list[str] = Field(default_factory=list)
    filiere: str | None = None
    level: str | None = None
    academic_year: str | None = None
    course_type: str | None = None
    language: str | None = None
    rrf_score: float


class SearchResponse(BaseModel):
    items: list[SearchResultItem]
    page: int
    limit: int
    total: int


class AutocompleteItem(BaseModel):
    course_id: str
    title: str
    type: str | None = None


@router.get("/search", response_model=SearchResponse, dependencies=[Depends(limiter(60, 60))])
async def search(
    request: Request,
    q: str | None = Query(None, min_length=1),
    filiere: str | None = None,
    niveau: str | None = None,
    type: str | None = None,
    annee: int | None = None,
    langue: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> SearchResponse:
    # Require at least one search parameter (query or filters)
    if not q and not filiere and not niveau and not type and not annee and not langue:
        raise atlas_error(
            "SEARCH_001",
            "Please provide a search query or at least one filter.",
            field="q",
            status_code=400,
        )

    # Validate minimum query length if provided
    if q and len(q.strip()) < 2:
        raise atlas_error(
            "SEARCH_002",
            "Search query must contain at least 2 characters.",
            field="q",
            status_code=400,
        )

    # US-XX: Auto-filter by student level if not provided
    if not niveau:
        role_value = (
            current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        )
        if role_value == "STUDENT" and current_user.level:
            niveau = current_user.level if not hasattr(current_user.level, "value") else current_user.level.value

    items = await execute_hybrid_search(
        query=q,
        filiere=filiere,
        niveau=niveau,
        annee=str(annee) if annee is not None else None,
        type_cours=type,
        langue=langue,
        is_official=None,
        top_k=limit,
        session=db,
        request_app_state=request.app.state,
    )

    dv_ids = [item.get("document_version_id") for item in items if item.get("document_version_id")]
    course_map: dict[str, str] = {}
    if dv_ids:
        result = await db.execute(
            select(DocumentVersion.id, Contribution.course_id)
            .join(Contribution, Contribution.id == DocumentVersion.contribution_id)
            .where(DocumentVersion.id.in_(dv_ids))
        )
        for dv_id, course_id in result.all():
            course_map[str(dv_id)] = str(course_id)

    enriched = []
    for item in items:
        dv_id = item.get("document_version_id")
        enriched.append(
            SearchResultItem(
                course_id=course_map.get(str(dv_id)),
                **item,
            )
        )

    return SearchResponse(
        items=enriched,
        page=page,
        limit=limit,
        total=len(enriched),
    )


@router.get("/search/autocomplete", response_model=list[AutocompleteItem], dependencies=[Depends(limiter(60, 60))])
async def autocomplete(
    q: str = Query(..., min_length=2),
    db: AsyncSession = Depends(get_session),
) -> list[AutocompleteItem]:
    try:
        result: dict[str, Any] = meili_client.index("documents").search(
            q,
            {
                "limit": 8,
                "attributesToRetrieve": ["document_version_id", "course_id", "title", "course_type"],
            },
        )
    except Exception as exc:
        raise atlas_error(
            "GEN_002",
            "Autocomplete service is currently unavailable.",
            field="q",
            status_code=503,
        ) from exc

    hits = result.get("hits", [])
    dv_ids_to_resolve: list[str] = []
    suggestions: list[AutocompleteItem] = []

    for hit in hits:
        course_id = hit.get("course_id")
        dv_id = hit.get("document_version_id")
        if not course_id and dv_id:
            dv_ids_to_resolve.append(str(dv_id))

    course_map: dict[str, str] = {}
    if dv_ids_to_resolve:
        lookup = await db.execute(
            select(DocumentVersion.id, Contribution.course_id)
            .join(Contribution, Contribution.id == DocumentVersion.contribution_id)
            .where(DocumentVersion.id.in_(dv_ids_to_resolve))
        )
        for dv_id, course_id in lookup.all():
            course_map[str(dv_id)] = str(course_id)

    for hit in hits:
        dv_id = str(hit.get("document_version_id", ""))
        resolved_course_id = str(hit.get("course_id") or course_map.get(dv_id, ""))
        suggestions.append(
            AutocompleteItem(
                course_id=resolved_course_id,
                title=hit.get("title", ""),
                type=hit.get("course_type"),
            )
        )
    return suggestions
