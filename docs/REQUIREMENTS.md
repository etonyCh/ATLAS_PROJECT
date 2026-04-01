# Requirements

## Functional Requirements

### Authentication

- users must be able to register
- users must be able to log in with email and password
- OTP verification must support account activation
- password reset must support OTP-based recovery
- role-based access control must protect restricted routes

### Course Access

- users must be able to browse courses
- users must be able to view course details
- users must be able to access course learning tools

### Study Tools

- students must be able to generate flashcards
- students must be able to review due flashcards
- students must be able to generate quizzes
- students must be able to submit quizzes
- students must be able to generate summaries
- students must be able to generate mind maps
- students must be able to chat with course AI assistant

### Contributions

- students must be able to upload contributions
- teachers and admins must be able to review contributions
- contribution status must be visible in the platform

### Notifications

- users must be able to retrieve notifications
- users must be able to mark notifications as read

### Gamification

- users must be able to view XP-related data
- users must be able to view leaderboard entries
- public profiles must be viewable through the public profile route

### Administration

- admins must be able to view user lists
- admins must be able to review reports
- superadmins must be able to view establishments

## Non-Functional Requirements

### Performance

- route responses should be reasonably fast for dashboard and list pages
- pagination should be used for list-heavy surfaces

### Maintainability

- frontend and backend contracts should stay aligned
- backend should remain the source of truth for DTO shape
- duplicate route registration and config sources should be avoided

### Security

- authentication must use validated tokens
- protected routes must use role checks
- user-scoped resources must enforce ownership

### Accessibility

- interactive controls should be keyboard reachable
- touch targets should remain usable on mobile
- layout should remain responsive on major viewport sizes

### Internationalization

- the frontend should support LTR and RTL layout directions
- typography should support Arabic as well as Latin scripts
