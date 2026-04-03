# ATLAS Documentation

This folder is the project documentation hub for ATLAS. It tracks the current
state of the platform after the identity, moderation, and file-preview
coherence pass.

## What Is Covered

- student-first registration with OTP activation
- teacher verification request and admin approval workflow
- admin and superadmin governance surfaces
- moderated contribution lifecycle and visibility rules
- secure file preview architecture for `PDF`, `DOCX`, `PPTX`, and images
- deployment, testing, and maintenance guidance

## Document Index

- `ASSESSMENT.md`
  Current product assessment, quality risks, and follow-up work.
- `PRODUCT_OVERVIEW.md`
  Product vision, user roles, and active platform capabilities.
- `USER_GUIDE.md`
  End-user guidance for student, teacher, admin, and superadmin flows.
- `API_REFERENCE.md`
  High-level API contracts and key endpoints.
- `ARCHITECTURE.md`
  System structure, trust model, moderation flow, and preview pipeline.
- `REQUIREMENTS.md`
  Functional and non-functional requirements summary.
- `DEVELOPMENT_PROCESS.md`
  Implementation workflow, quality expectations, and delivery process.
- `TEST_REPORT.md`
  Validation already performed and current testing gaps.
- `DEPLOYMENT_AND_OPERATIONS.md`
  Runtime dependencies, setup guidance, and operations notes.
- `MAINTENANCE.md`
  Ongoing repair, cleanup, and support guidance.
- `RELEASE_READINESS.md`
  Release decision framing and go-live checklist.

## Recommended Reading Order

1. `PRODUCT_OVERVIEW.md`
2. `ARCHITECTURE.md`
3. `API_REFERENCE.md`
4. `USER_GUIDE.md`
5. `DEPLOYMENT_AND_OPERATIONS.md`

## Current Coherence Notes

- Public registration is student-only.
- Teachers request access through verification, not direct public signup.
- Uploaded files remain private until moderation allows visibility.
- Admin, teacher, and student preview flows now share one secure preview path.
- Inline preview currently supports `PDF`, `PNG`, `JPG`, `JPEG`, `DOCX`, and
  `PPTX`.
- Legacy `DOC` and `PPT` files still use open/download fallback with extracted
  text preview when available.
