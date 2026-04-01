# API Reference

## Overview

The backend exposes a REST API under:

- `/api/v1`

The frontend uses typed API clients from:

- `frontend/src/lib/api.ts`

## Authentication

### POST `/api/v1/auth/register`

Registers a new user.

Request:

```json
{
  "email": "user@example.com",
  "password": "Password123!",
  "full_name": "Jane Doe",
  "role": "STUDENT"
}
```

### POST `/api/v1/auth/login`

Authenticates a user.

Request:

```json
{
  "email": "user@example.com",
  "password": "Password123!"
}
```

Response:

```json
{
  "accessToken": "string",
  "refreshToken": "string",
  "user": {}
}
```

### POST `/api/v1/auth/verify-otp`

Verifies an OTP.

Request:

```json
{
  "email": "user@example.com",
  "otp_code": "123456",
  "purpose": "ACCOUNT_ACTIVATION"
}
```

### POST `/api/v1/auth/resend-otp`

Resends activation or onboarding OTP.

### POST `/api/v1/auth/forgot-password`

Requests a password reset OTP.

### POST `/api/v1/auth/reset-password`

Completes password reset.

### POST `/api/v1/auth/refresh`

Refreshes the access token using refresh cookies.

### POST `/api/v1/auth/logout`

Clears auth state.

## Courses

### GET `/api/v1/courses`

Returns a course list.

### GET `/api/v1/courses/{course_id}`

Returns course detail.

### GET `/api/v1/courses/{course_id}/versions`

Returns course versions.

### GET `/api/v1/courses/{course_id}/download-url`

Returns a temporary download URL.

### POST `/api/v1/courses/upload`

Uploads a course file or related content.

## Contributions

### POST `/api/v1/contributions`

Creates a student contribution.

### GET `/api/v1/contributions/me`

Returns paginated contributions for the current student.

Response shape:

```json
{
  "items": [],
  "meta": {
    "total": 0,
    "limit": 20,
    "offset": 0,
    "has_more": false
  }
}
```

### GET `/api/v1/admin/contributions`

Returns paginated contribution review queue.

### PATCH `/api/v1/admin/contributions/{contribution_id}`

Reviews a contribution.

## Reports

### POST `/api/v1/reports`

Creates a report/feedback item.

### GET `/api/v1/admin/reports`

Returns paginated admin report list.

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

RAG messages list is paginated with the standard `items/meta` shape.

## Forums

- `GET /api/v1/forums/posts`
- `POST /api/v1/forums/posts`
- `GET /api/v1/forums/posts/{post_id}`
- `PATCH /api/v1/forums/posts/{post_id}`
- `DELETE /api/v1/forums/posts/{post_id}`
- `POST /api/v1/forums/posts/{post_id}/replies`
- `POST /api/v1/forums/posts/{post_id}/vote`
- `PATCH /api/v1/forums/replies/{reply_id}/pin`

## Notifications

- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/{notification_id}`

Notifications use the standard paginated response shape.

## Dashboard

- `GET /api/v1/students/me/dashboard`
- `GET /api/v1/students/me/history`
- `GET /api/v1/teacher/analytics`
- `GET /api/v1/teacher/courses/{course_id}/analytics`
- `GET /api/v1/admin/dashboard`
- `GET /api/v1/admin/analytics/export`

## Gamification

- `GET /api/v1/users/{user_id}/xp`
- `GET /api/v1/users/{user_id}/badges`
- `GET /api/v1/leaderboard`
- `GET /api/v1/profile/{username}`

## Notes

- The backend is the contract source of truth.
- Frontend types should track backend responses directly, not invent fallback
  fields.
- Paginated list responses should use the standard `items/meta` envelope.
