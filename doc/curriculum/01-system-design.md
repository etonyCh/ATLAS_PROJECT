# 1. System Design (The Blueprint)

## Overview

System design is the architecture phase of building software. Instead of focusing on a single line of code, you look at how different services communicate. The goal is **scalability** — ensuring your application doesn't crash when you go from 100 users to 1 million.

## Core Concepts

### Microservices Architecture

- Decomposing monolithic applications into independent, deployable services
- Service boundaries defined by business capabilities (Domain-Driven Design)
- Each service owns its data, logic, and deployment lifecycle
- Trade-off: complexity vs. independent scalability

### Communication Patterns

- **Synchronous**: REST, gRPC, GraphQL
- **Asynchronous**: Message queues (RabbitMQ, Kafka), event-driven architectures
- **Service Mesh**: Istio, Linkerd for service-to-service communication management

### Scalability Patterns

- **Horizontal scaling**: Adding more instances behind a load balancer
- **Vertical scaling**: Increasing resources on a single machine
- **Database sharding**: Splitting data across multiple database instances
- **Caching layers**: Redis, Memcached to reduce database load

### Design Principles

- **Separation of Concerns**: Each component has a single responsibility
- **Loose Coupling**: Services minimize dependencies on each other
- **High Cohesion**: Related functionality stays together
- **Fail-Fast**: Detect and report errors as early as possible
- **Graceful Degradation**: System remains partially functional during failures

### CAP Theorem

In a distributed system, you can only guarantee two of three:

- **Consistency**: Every read receives the most recent write
- **Availability**: Every request receives a response
- **Partition Tolerance**: System continues despite network failures

### Eventual Consistency

- Accepting temporary inconsistency for higher availability
- Common in large-scale distributed systems
- Techniques: CRDTs, conflict resolution, vector clocks

## Real-World Example

When you load a social media feed:

1. **API Gateway** routes your request
2. **Auth Service** validates your session
3. **Feed Service** fetches your personalized feed from cache
4. **Content Service** retrieves post details
5. **Media Service** serves images/videos from CDN
6. **Analytics Service** logs your interaction asynchronously

## Key Takeaways

- Start with a monolith, split when you have a reason
- Design for failure — everything fails eventually
- Measure before you optimize
- Document your architecture decisions (ADRs)
