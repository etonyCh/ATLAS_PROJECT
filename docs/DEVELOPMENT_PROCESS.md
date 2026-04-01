# Development Process

## Development Model

The project follows an iterative product-development model with:

- feature implementation
- contract alignment
- testing and regression checks
- cleanup and UX refinement

## Recommended Workflow

1. Define or update backend contract.
2. Implement backend logic and validation.
3. Mirror contract in frontend types.
4. Wire query/mutation hooks.
5. Implement or update page/component behavior.
6. Run type checks and route/schema validation.
7. Run targeted manual or automated QA.

## Code Quality Practices

- keep backend as API contract source of truth
- avoid frontend fake fallback fields for missing backend data
- prefer paginated envelopes for list endpoints
- centralize shared behavior such as auth and router registration

## Review Focus

Important review categories:

- API contract correctness
- role/permission correctness
- empty/loading/error states
- responsiveness
- dead code and duplicate architecture

## Change Management

Recommended logical change groups:

- backend architecture
- auth contract
- list pagination standardization
- study-tool DTO harmonization
- mock-data removal
- compile and responsiveness fixes

## Documentation Process

Whenever a feature changes:

- update API contract docs
- update user guide if end-user behavior changed
- update architecture docs if system structure changed
- update readiness or maintenance docs if release or ops implications changed
