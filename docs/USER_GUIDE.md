# User Guide

## Getting Started

### Student Account Creation

1. Open the public registration page.
2. Create a student account with name, email, password, and academic details.
3. Verify the account using the OTP sent to email.
4. Log in through the shared login page.

### Teacher Access Request

1. Open the teacher request page.
2. Submit institutional email, password, name, and department.
3. Verify the onboarding OTP.
4. Wait for admin approval.
5. Log in through the same shared login page after approval.

### Admin And Superadmin Access

- create or seed an account first
- promote it using the backend helper scripts when needed
- log in through the normal login page

## Student Guide

### Browse And Read Courses

- open the courses area
- choose a course
- open the reader

Students can preview approved course files directly inside the platform when the
file type is supported.

### Preview Support For Students

Inline preview currently supports:

- `PDF`
- `PNG`
- `JPG`
- `JPEG`
- `DOCX`
- `PPTX`

Legacy `DOC` and `PPT` files still open through fallback actions.

### Use Study Tools

From a course page, students can open:

- Reader
- AI Chat
- Flashcards
- Quiz
- Summary
- Mind Map

### Submit A Contribution

1. Open the upload/contribution flow.
2. Provide the required course and document details.
3. Upload a supported file.
4. Submit the contribution for moderation.

### Review Your Own Contributions

Students can open `My Contributions` to:

- see pending, approved, and rejected items
- preview their own uploaded files
- review rejection feedback when available

Important rule:

- students can preview their own pending uploads
- other learners cannot access those uploads until moderation approves them

## Teacher Guide

### Manage Courses

Teachers can upload and manage course materials from teacher surfaces.

### Review Contributions

Teachers can open the contribution review area to:

- preview uploaded files in-app
- approve or reject content
- leave moderation notes when rejecting

### Preview Support For Teachers

Teachers use the same shared preview system as admins and students.

Inline preview currently supports:

- `PDF`
- `PNG`
- `JPG`
- `JPEG`
- `DOCX`
- `PPTX`

## Admin Guide

### Manage Users

Admins can:

- filter users by role
- adjust user state
- review institution-level operational data

### Review Teacher Requests

Admins can open the teacher requests area to:

- inspect pending educator requests
- approve requests
- activate teacher access

### Moderate Contributions

Admins can open the moderation hub to:

- preview pending documents before approval
- approve contributions
- reject contributions with feedback

### Admin Preview Rules

Admins can preview pending uploads before students can see them. This is
required for moderation quality control.

## Superadmin Guide

Superadmins can:

- inspect platform-wide institutional structures
- access elevated operational views

## File Preview Notes

The preview system is shared across student, teacher, and admin surfaces.

### Inline Preview

- `PDF`
- `PNG`
- `JPG`
- `JPEG`
- `DOCX`
- `PPTX`

### Fallback Preview

- `DOC`
- `PPT`

These can still be opened or downloaded, and extracted text preview may appear
when available.
