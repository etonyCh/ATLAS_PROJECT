# Maintenance Guide

## Purpose

This document describes how to maintain, repair, and continue improving the
ATLAS platform.

## Codebase Maintenance Priorities

### 1. Remove Legacy Backend Tree

The `backend/app/api/v1/endpoints` tree is now legacy architecture.

Before deleting it:

- refactor remaining imports in legacy modules
- especially remove dependencies from `backend/app/core/rbac.py`
- confirm no runtime path still depends on that tree

### 2. Remove Compatibility Wrappers When Safe

These wrappers still exist:

- `backend/app/config.py`
- `backend/app/database.py`

They should be deleted only after all imports have been migrated to:

- `app.core.config`
- `app.db.session`

### 3. Keep Contracts Synchronized

Any change to backend responses should be reflected in:

- `frontend/src/types/api.types.ts`
- `frontend/src/lib/api.ts`
- relevant query hooks

### 4. Maintain Responsiveness

When editing table-heavy or dashboard pages:

- verify mobile layout
- prefer card stacks below `md` when necessary
- keep touch targets at least 44px high

## Repair Guidance

### If Auth Breaks

Check:

- `/api/v1/auth/login`
- refresh cookie path
- access token decode logic
- OTP request/verify payloads

### If Frontend Data Breaks

Check:

- `frontend/src/lib/api.ts`
- matching backend router
- frontend type definitions
- whether list responses still use the standard `items/meta` shape

### If Study Tools Break

Check:

- document version retrieval
- generation services
- queue/worker logs
- frontend generation and result retrieval hooks

### If Admin Pages Break

Check:

- pagination metadata
- report and user DTO shapes
- whether admin query hooks still call the correct client methods

## Recommended Maintenance Cadence

- weekly dependency review
- weekly QA smoke test
- per-release contract review
- per-release docs refresh
