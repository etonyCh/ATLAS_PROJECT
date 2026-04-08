# 2. APIs (The Language)

## Overview

APIs (Application Programming Interfaces) are how different parts of a system talk to each other. They are the contracts between services, and good API design is one of the most valuable skills a developer can have.

## API Paradigms

### REST (Representational State Transfer)

- Resource-based URLs: `/users/123/posts`
- HTTP methods map to operations: GET, POST, PUT, PATCH, DELETE
- Stateless: each request contains all necessary information
- HATEOAS: responses include links to related resources
- **Best for**: Public APIs, CRUD operations, simple integrations

### GraphQL

- Single endpoint, client specifies exactly what data it needs
- Strongly typed schema as the contract
- Solves over-fetching and under-fetching problems
- **Best for**: Complex UIs with varying data requirements, mobile apps

### gRPC

- Protocol Buffers for efficient binary serialization
- HTTP/2 for multiplexed, bidirectional communication
- Built-in streaming support
- **Best for**: Internal service-to-service communication, real-time systems

### WebSockets & Server-Sent Events

- Persistent, bidirectional connections
- **Best for**: Real-time features (chat, live updates, notifications)

## API Design Best Practices

### Versioning

- URL versioning: `/api/v1/users`
- Header versioning: `Accept: application/vnd.atlas.v1+json`
- Never break existing clients — deprecate, don't delete

### Error Handling

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email format is invalid",
    "field": "email",
    "details": "Expected format: user@domain.com"
  }
}
```

### Pagination

- Cursor-based: `?after=cursor_abc123&limit=20`
- Offset-based: `?page=2&per_page=20`
- Always include metadata: `total`, `has_next`, `next_cursor`

### Authentication & Authorization

- API Keys: Simple, for server-to-server
- JWT (JSON Web Tokens): Stateless, for user sessions
- OAuth 2.0 / OIDC: Delegated authorization, third-party access
- mTLS: Mutual authentication for service-to-service

### Rate Limiting

- Protect your API from abuse and overload
- Common strategies: Token bucket, sliding window, fixed window
- Return headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## API Documentation

- **OpenAPI/Swagger**: Machine-readable spec, generates docs and clients
- **Postman Collections**: Interactive documentation and testing
- **Redoc**: Beautiful auto-generated docs from OpenAPI specs

## Key Takeaways

- Design the API before you build it
- Be consistent in naming, structure, and error formats
- Document everything — undocumented APIs are broken APIs
- Version from day one, even if you only have v1
