# ATLAS Hybrid Implementation Phase Tracker

This file is the living progress tracker for the ATLAS project.

Guiding rule:
- `ATLAS Spec` is the execution backbone.
- `DeepSeek Spec` is used only for safe, high-impact improvements.
- We avoid late-stage rewrites that threaten delivery.

## Delivery Strategy

Base split:
- `90%` ATLAS execution
- `10%` DeepSeek-inspired optimization

Safe improvements we can include:
- modular monolith organization by domain
- better RAG grounding and response verification
- stronger logging and developer quality checks
- practical Redis and caching improvements

Risky changes we will avoid unless explicitly approved later:
- GraphQL rewrite
- dual vector database redesign
- full DDD rewrite
- microservices migration
- serverless multi-cloud redesign

## Phase Status Legend

- `Not Started`
- `In Progress`
- `Done`
- `Deferred`

## Phase Plan

| Phase | Objective | Status | Notes |
| --- | --- | --- | --- |
| 1 | Baseline alignment: compare repo against ATLAS spec and DeepSeek recommendations | Done | Initial analysis completed on 2026-04-04 |
| 2 | Lock execution backbone: keep ATLAS delivery path and identify only safe upgrades | Done | Repo-aligned keep/improve/defer decisions recorded on 2026-04-04 |
| 3 | Modular backend refinement: improve domain boundaries without rewriting architecture | Done | Router registration grouped by domain on 2026-04-04 |
| 4 | AI and RAG hardening: improve relevance filtering, grounding, and hallucination resistance | Done | Added query guardrails and relevance filtering on 2026-04-04 |
| 5 | Dev quality improvements: hooks, review discipline, logging, validation, quality gates | Done | Added frontend typecheck gate and reduced lint noise on 2026-04-04 |
| 6 | Caching and performance refinement: practical Redis improvements and bottleneck cleanup | Done | Added TTL jitter and shared cache TTL usage on 2026-04-04 |
| 7 | Final consolidation: testing, documentation, PFE-safe delivery review | Done | Added delivery review checkpoint on 2026-04-04 |

## Phase Update Log

### 2026-04-04 - Phase 1 Done

Summary:
- Read and analyzed the ATLAS engineering specification.
- Read and analyzed the DeepSeek engineering recommendations.
- Reviewed the current repository structure and supporting project documentation.
- Confirmed that the two specs are complementary, not competing.

Decision:
- The project should continue with `ATLAS` as the base implementation path.
- `DeepSeek` ideas should be used selectively as improvements, not as a replacement.

Why this matters:
- Following ATLAS alone is enough to finish the PFE.
- Replacing ATLAS with DeepSeek now would create delivery risk.
- A hybrid approach gives the best balance between completion and quality.

### 2026-04-04 - Phase 2 Done

Summary:
- Confirmed the repository already follows the ATLAS execution direction in practice.
- Verified the platform is a working monolith with role-based routes, search, RAG, dashboards, and study tools.
- Identified which DeepSeek-style ideas are already partially present and which should remain deferred.

Keep as backbone:
- FastAPI + Next.js monolith structure
- PostgreSQL + Redis + MinIO + MeiliSearch infrastructure
- current auth, contribution, dashboard, study, and RAG flows
- current deployment and delivery direction focused on finishing the PFE safely

Improve next:
- backend modularity by domain without changing deployment topology
- RAG response grounding and relevance filtering
- logging, quality gates, and developer workflow discipline
- practical cache and performance improvements around Redis and search

Defer intentionally:
- GraphQL introduction
- dual vector database redesign
- full DDD and CQRS rewrite
- microservices split
- large deployment architecture changes

Decision:
- Continue implementation with `ATLAS` as the source of truth for delivery.
- Use `DeepSeek` only as a selective improvement layer.

Why this matters:
- This protects timeline and delivery confidence.
- It also leaves room for targeted improvements that help the project stand out.

## Repo-Aligned Execution Rules

### Keep

- Keep the current backend entrypoint and router registry model.
- Keep the current frontend route-group structure and role-based surfaces.
- Keep the existing infrastructure stack already reflected in the repository.

### Improve Carefully

- Refactor internally by domain where it reduces confusion.
- Strengthen AI answer trustworthiness before adding new AI complexity.
- Prefer quality and observability improvements over new architectural experiments.

### Defer

- Any change that requires replacing stable flows instead of improving them.
- Any redesign that creates migration risk without helping soutenance readiness.

### 2026-04-04 - Phase 3 Done

Summary:
- Refined backend router registration into domain-oriented groups.
- Kept the same FastAPI monolith and the same API prefixes.
- Improved readability of the backend entry structure without changing endpoint behavior.

What changed:
- grouped API registration into `core platform`, `academic experience`, `community and engagement`, and `operations and governance`
- centralized grouped registration through a small helper
- kept websocket router registration explicit and unchanged in behavior

Verified:
- ran Python bytecode compilation on the updated router registry successfully

Decision:
- keep this refinement
- continue modular cleanup only when it stays behavior-safe

Risks or follow-up:
- deeper modularization should stay incremental and avoid broad endpoint rewrites

## Phase 4 Target

Objective:
- Improve AI and RAG trustworthiness without replacing the current pipeline.

Planned direction:
- inspect retrieval and response generation flow
- add one safe grounding or relevance improvement
- keep streaming and current user flow intact

### 2026-04-04 - Phase 4 Done

Summary:
- Added a RAG query guardrail to reject empty or obviously unsafe prompt-injection-like inputs.
- Tightened retrieval context assembly so only sufficiently relevant chunks are passed to generation.
- Improved source metadata by returning the top retrieved chunk index as the source page placeholder instead of always returning `1`.

What changed:
- created `backend/app/services/ai_core/guardrails.py`
- applied sanitization in the RAG message creation endpoint
- added relevance filtering thresholds in `rag_storage.py`
- added targeted unit tests for the new RAG guardrail behavior

Verified:
- Python compilation passed for the updated RAG modules
- targeted unit test file passed: `3 passed`

Decision:
- keep these trust improvements
- continue improving AI reliability in small, testable increments

Risks or follow-up:
- current source page reporting is still chunk-based, not true PDF-page-aware citation mapping
- a future step can improve citation fidelity if page metadata becomes available in embeddings

## Phase 5 Target

Objective:
- Improve development quality gates without introducing workflow friction.

Planned direction:
- inspect current lint, hook, and test workflow coverage
- add one practical quality gate that matches the current stack
- keep changes lightweight and repo-safe

### 2026-04-04 - Phase 5 Done

Summary:
- Added a formal frontend TypeScript quality gate using `tsc --noEmit`.
- Reduced frontend lint noise by excluding generated and report artifacts from ESLint.
- Kept the improvement lightweight so it helps development immediately without introducing workflow friction.

What changed:
- updated `frontend/package.json` with a `typecheck` script
- updated `frontend/eslint.config.mjs` ignores for `public`, `playwright-report`, and `test-results`

Verified:
- `npm run typecheck` passed successfully
- `npm run lint` now reports a much smaller, actionable issue set instead of thousands of generated-file findings

Decision:
- keep the `typecheck` gate as the reliable frontend baseline check
- treat the remaining lint errors as focused cleanup work, not as noise

Risks or follow-up:
- frontend lint still has real code issues to address later
- current lint status is improved but not yet green

## Phase 6 Target

Objective:
- Improve practical cache and performance behavior without redesigning infrastructure.

Planned direction:
- inspect current Redis and cache usage
- add one low-risk improvement around cache keys, TTLs, or resilience
- keep search and user-facing behavior stable

### 2026-04-04 - Phase 6 Done

Summary:
- Added shared TTL jitter for Redis cache writes to reduce synchronized expiry bursts.
- Replaced a hardcoded dashboard cache TTL with configured settings.
- Reused the same cache refinement approach for search results.

What changed:
- added `ttl_with_jitter()` in `backend/app/core/cache.py`
- applied jittered search cache writes in `backend/app/services/ai_core/rag_inference.py`
- applied settings-based jittered dashboard cache writes in `backend/app/services/study_engine/dashboard_service.py`
- added unit tests for the cache helper

Verified:
- targeted backend unit tests passed: `5 passed`
- Python compilation passed for the touched cache-related modules

Decision:
- keep this cache refinement
- continue preferring small resilience improvements over architecture churn

Risks or follow-up:
- cache invalidation strategy is still partial and can be improved later
- this step improves refresh behavior, not full cache observability

### 2026-04-04 - Phase 7 Done

Summary:
- Created a concise delivery review note for the current ATLAS implementation state.
- Captured what is stronger now, what is verified, and what still needs attention for PFE-safe delivery.

What changed:
- added `doc/PFE_DELIVERY_REVIEW.md`

Verified:
- documentation file created successfully in the repository

Decision:
- use the phase tracker as the running implementation log
- use the delivery review file as the current high-level readiness checkpoint

### 2026-04-04 - Frontend Quality Cleanup Checkpoint

Summary:
- Reduced frontend lint noise incrementally until the codebase reached a fully clean lint run.
- Kept fixes focused on low-risk issues first, then resolved the remaining concentrated warnings.
- Left the ATLAS delivery path intact while improving confidence in day-to-day frontend development.

What changed:
- removed unused imports, variables, and a few stale props across student, teacher, admin, and shared UI files
- corrected a `useWebSocket` export issue in the shared hooks index
- tightened a few component typings and small hook usage issues
- documented the single `react-hooks/incompatible-library` case locally in the PDF previewer

Verified:
- `npm run lint` passed successfully with `0 errors` and `0 warnings`
- `npm run typecheck` remains available as a passing frontend quality gate

Decision:
- keep lint and typecheck as the frontend baseline quality checks
- continue future cleanup in small, behavior-safe batches when needed

### 2026-04-04 - PDF Preview Integration Checkpoint

Summary:
- Verified the shared PDF preview flow in runtime for the main student reader and teacher contribution-review surfaces.
- Replaced the teacher live-session placeholder PDF with the actual course-linked preview flow.
- Added browser-level regression checks so these preview paths stay covered.

What changed:
- updated the teacher live-session host page to pass real `courseId` context into sessions
- updated the teacher live-session detail page to load the attached course PDF through the existing course preview API
- removed dependence on the hard-coded external arXiv PDF in the live-session viewer
- added targeted Playwright coverage in `frontend/tests/e2e/pdf-preview.spec.ts`

Verified:
- `npm run lint` passed successfully
- `npm run typecheck` passed successfully
- targeted browser verification passed: `3 passed`
- verified flows:
  - student course reader preview
  - teacher contribution review preview
  - teacher live-session PDF sync using a real course document source

Decision:
- keep `FilePreview` and `PDFPreviewer` as the shared document-preview backbone
- keep live-session PDF presentation tied to real approved course material only

Risks or follow-up:
- live PDF sync currently supports PDF course files; non-PDF course materials show an explicit fallback state
- `react-pdf` text and annotation layer styles are now loaded globally, so the browser preview warnings are resolved

### 2026-04-04 - Workspace Pivot Checkpoint

Summary:
- Converted the repository root from a duplicate frontend package into a true npm workspace orchestrator.
- Removed the nested active frontend lockfile from the runtime path and regenerated the workspace install from the root.
- Unified `next` and React type resolution across the workspace so root-driven lint, typecheck, and Playwright runs stay consistent.

What changed:
- replaced the root `package.json` with a workspace-root manifest targeting `frontend`
- added root scripts that delegate `dev`, `build`, `lint`, `typecheck`, and PDF preview testing into the `frontend` workspace
- archived the old nested frontend lockfile at `doc/workspace_migration_archive/frontend.package-lock.pre-workspace.json`
- added root workspace overrides to keep `next`, `@types/react`, and `@types/react-dom` aligned with the frontend app
- regenerated the root `package-lock.json` through a clean workspace install

Verified:
- `npm run lint` passed from the repository root
- `npm run typecheck` passed from the repository root
- `npm run test:pdf-preview` passed from the repository root with `3 passed`
- the previous Next.js multiple-lockfile workspace-root warning no longer appears in the validated test run

Decision:
- keep the root as the workspace orchestrator
- keep `frontend/` as the only active web application package

Risks or follow-up:
- Playwright browser binaries may need reinstall after future dependency resets
- the remaining `pdfjs-dist` “legacy build in Node.js environments” warning is separate from the workspace-root issue and can be handled in a later focused pass

Risks or follow-up:
- final readiness still depends on further frontend lint cleanup and broader integration validation

### 2026-04-04 - Post-Phase Frontend Lint Cleanup

Summary:
- Reduced frontend lint from hard errors plus noisy generated-file findings down to warnings only.
- Added several low-risk typing, hook, and UI text fixes across shared frontend components and admin/student flows.
- Preserved the step-by-step approach by fixing issues in small verified batches.

Verified:
- `npm run lint` now completes with `0 errors`
- `npm run typecheck` remains available as a passing frontend gate

Remaining debt:
- lint warnings still exist and should be cleaned gradually
- most remaining issues are unused imports/variables and a few hook dependency warnings

### 2026-04-04 - Warning Cleanup Continuation

Summary:
- Continued warning cleanup with another low-risk batch focused on unused imports, unused parameters, and minor configuration noise.
- Kept the frontend lint run green on errors while reducing the warning count further.

Verified:
- `npm run lint` passes with `0 errors`
- warning count reduced further to `62 warnings`

### 2026-04-04 - PDF.js Runtime Warning Cleanup

Summary:
- Removed the remaining `pdfjs-dist` Node-environment warning from the validated PDF preview flow.
- Applied the fix at the Next.js bundler layer so `react-pdf` resolves the legacy PDF.js build automatically.
- Completed the final small cleanup from the infrastructure migration phase.

What changed:
- updated `frontend/next.config.ts` to alias `pdfjs-dist` to `pdfjs-dist/legacy/build/pdf.mjs` for both Turbopack and Webpack
- removed the archived pre-workspace frontend lockfile after the workspace install path proved stable

Verified:
- `npm run lint` passed from the repository root
- `npm run typecheck` passed from the repository root
- `npm run test:pdf-preview` passed from the repository root with `3 passed`
- the previous `pdfjs-dist` legacy-build warning no longer appears in the validated PDF preview test run

Decision:
- keep the workspace-root package as the only installation entrypoint
- keep the PDF preview stack on the current shared `react-pdf` path with the bundler alias in place

Workspace contract:
- run `npm install` only from the repository root
- add frontend packages with `npm install <package> -w frontend`
- treat the root `package-lock.json` as the single lockfile source of truth

## Update Template

Use this format whenever a phase is completed:

```md
### YYYY-MM-DD - Phase X Done

Summary:
- what was completed
- what changed
- what was verified

Decision:
- keep / improve / defer

Risks or follow-up:
- anything still open
```
