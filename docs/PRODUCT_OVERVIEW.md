# Product Overview

## Product Name

ATLAS

Aggregated Tunisian Learning & Academic System

## Product Purpose

ATLAS is an academic platform for higher education that combines:

- course distribution
- AI-assisted study workflows
- moderated content contribution
- institutional governance
- trust-aware identity and access control

The product is designed to serve students, teachers, admins, and superadmins
inside one shared ecosystem without splitting the platform into separate auth
universes.

## Primary User Roles

### Student

Students can:

- create an account directly
- verify email by OTP
- browse approved course materials
- read and preview supported files
- use AI chat, flashcards, quizzes, summaries, and mind maps
- upload contributions for moderation
- preview their own uploads, even before approval

### Teacher

Teachers can:

- request educator access using the teacher verification flow
- manage uploads and course materials
- review contributions in moderation surfaces
- preview supported files in-app before decision
- access teacher-oriented dashboard data

### Admin

Admins can:

- manage users
- review teacher verification requests
- approve pending teachers
- moderate contributions
- preview pending files before approval
- review operational dashboards and reports

### Superadmin

Superadmins can:

- oversee platform-wide structures
- manage institutional visibility
- access elevated governance capabilities

## Core Product Modules

### Identity And Access

- student self-registration
- teacher verification request workflow
- OTP verification
- password reset
- role-aware routing
- account status controls
- trust score and profile completeness fields

### Courses And Reader

- course catalog
- course detail pages
- document reader
- file preview and download flow

### Study Tools

- AI chat
- flashcards
- quiz
- summary
- mind map

### Contributions And Moderation

- student upload flow
- teacher/admin moderation queue
- approval and rejection workflow
- uploader notifications
- visibility gating until approval

### Governance

- admin user management
- teacher approval queue
- reports and moderation hub
- superadmin institutional oversight

## Preview Experience

ATLAS now supports a shared in-app preview experience across student, teacher,
and admin flows.

### Inline Preview

- `PDF`
- `PNG`
- `JPG`
- `JPEG`
- `DOCX`
- `PPTX`

### Best-Effort Fallback

- `DOC`
- `PPT`

These legacy formats currently use open/download fallback with extracted text
preview when available.

## Current Product Strengths

- one login entry for all users
- trust-aware educator onboarding
- typed frontend/backend contract layer
- moderated content lifecycle instead of direct public publishing
- secure preview path that respects approval state
- strong foundation for AI-assisted study workflows

## Current Product Limitations

- legacy Office preview still needs server-side conversion for true parity
- some analytics and dashboard surfaces remain lighter than the long-term vision
- some deleted legacy routes still create local development noise until cleanup

## Product Positioning

ATLAS is best positioned as:

- an AI-enhanced academic workspace
- a moderated learning-content ecosystem
- a trust-aware ed-tech platform for universities and faculties
