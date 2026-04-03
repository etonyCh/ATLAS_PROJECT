# API Reference

## Overview

Backend REST endpoints are exposed under:

- `/api/v1`

Frontend uses typed API clients from:

- `frontend/src/lib/api.ts`

For browser preview safety, the frontend also exposes a same-origin proxy route:

- `/api/files/proxy/{path...}`

That proxy forwards authenticated preview requests to the backend file endpoint.

## Authentication

### POST `/api/v1/auth/register`

Creates a public student account.

Notes:

- this is student-only registration
- teacher creation does not use this route anymore

### POST `/api/v1/auth/teacher-request`

Creates a teacher verification request and sends onboarding OTP.

### POST `/api/v1/auth/verify-otp`

Verifies activation or reset OTP.

### POST `/api/v1/auth/resend-otp`

Resends OTP for supported flows.

### POST `/api/v1/auth/login`

Authenticates any platform user through the shared login entry.

### POST `/api/v1/auth/refresh`

Refreshes access token state using refresh cookies.

### GET `/api/v1/auth/me`

Returns the current authenticated user contract.

### POST `/api/v1/auth/logout`

Clears session state.

### POST `/api/v1/auth/forgot-password`

Starts the password reset flow.

### POST `/api/v1/auth/reset-password`

Completes password reset.

## Courses

### GET `/api/v1/courses`

Returns visible course entries for the current user.

### GET `/api/v1/courses/{course_id}`

Returns course detail plus current visible version metadata when allowed.

### GET `/api/v1/courses/{course_id}/versions`

Returns visible document versions for the course.

### GET `/api/v1/courses/{course_id}/preview`

Returns preview metadata for the course file.

### GET `/api/v1/courses/{course_id}/download-url`

Returns a temporary download URL when the user is allowed to access the file.

### POST `/api/v1/courses/upload`

Uploads a teacher/admin course document.

## Contributions

### POST `/api/v1/contributions`

Creates a student contribution.

Supported file families:

- `PDF`
- `DOC`
- `DOCX`
- `PPT`
- `PPTX`
- `PNG`
- `JPG`
- `JPEG`

### GET `/api/v1/contributions/me`

Returns paginated contributions for the current student, including preview
metadata such as:

- `s3_key`
- `mime_type`
- `preview_text`

### GET `/api/v1/admin/contributions`

Returns paginated moderation queue items with preview metadata.

### PATCH `/api/v1/admin/contributions/{contribution_id}`

Reviews a contribution.

Accepted review intent currently supports the normalized outcomes:

- `APPROVED`
- `REJECTED`
- `REVISION_REQUESTED`

Frontend currently sends approve/reject actions through this route.

## Teacher Verification

### GET `/api/v1/admin/teacher-requests`

Returns paginated teacher verification requests.

### POST `/api/v1/admin/teacher-requests/{request_id}/approve`

Approves a pending teacher request and activates the teacher account.

## User Management

### GET `/api/v1/admin/users`

Returns paginated user list for admin operations.

### PATCH `/api/v1/admin/users/{user_id}`

Updates selected user state such as role or activation flags.

## Files

### GET `/api/v1/files/proxy/{path:path}`

Secure backend file proxy used for preview and protected file retrieval.

Access rules:

- admins and superadmins can preview moderated and pending files
- uploaders can preview their own files
- regular learners only receive approved files

### GET `/api/files/proxy/{path...}`

Frontend same-origin proxy route that forwards preview requests to the backend
file proxy with auth headers.

## Reports

### POST `/api/v1/reports`

Creates a report or feedback item.

### GET `/api/v1/admin/reports`

Returns paginated admin report list.

### PATCH `/api/v1/admin/reports/{report_id}`

Marks a report resolved with the chosen action payload.

## Study Tools

### Flashcards

- `POST /api/v1/flashcards/generate`
- `GET /api/v1/flashcards/decks`
- `GET /api/v1/flashcards/decks/{deck_id}`
- `GET /api/v1/flashcards/due`
- `PATCH /api/v1/flashcards/{card_id}/review`
- `GET /api/v1/flashcards/decks/{deck_id}/share`

### Quiz

- `POST /api/v1/quiz/generate`
- `GET /api/v1/quiz/sessions`
- `GET /api/v1/quiz/{quiz_id}`
- `POST /api/v1/quiz/{quiz_id}/submit`
- `GET /api/v1/quiz/history`

### Summary

- `POST /api/v1/summaries/generate`
- `GET /api/v1/summaries/{summary_id}`

### Mind Map

- `POST /api/v1/mindmaps/generate`
- `GET /api/v1/mindmaps/{mindmap_id}`

### RAG Chat

- `POST /api/v1/rag/sessions`
- `GET /api/v1/rag/sessions/{session_id}`
- `GET /api/v1/rag/sessions/{session_id}/messages`
- `POST /api/v1/rag/sessions/{session_id}/messages`
- `DELETE /api/v1/rag/sessions/{session_id}`

## Dashboards And Notifications

- `GET /api/v1/students/me/dashboard`
- `GET /api/v1/students/me/history`
- `GET /api/v1/teacher/analytics`
- `GET /api/v1/teacher/courses/{course_id}/analytics`
- `GET /api/v1/admin/dashboard`
- `GET /api/v1/admin/analytics/export`
- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/{notification_id}`

## Contract Notes

- backend responses are the source of truth
- frontend contract types should mirror backend behavior directly
- paginated responses use the standard `items/meta` envelope where supported
