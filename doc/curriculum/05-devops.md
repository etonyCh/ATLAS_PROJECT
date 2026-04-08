# 5. DevOps (The Factory)

## Overview

DevOps is about how code gets from your laptop to the real world. It combines development and operations into a continuous pipeline of building, testing, deploying, and monitoring. The goal: ship fast, ship safely, ship often.

## CI/CD Pipeline

### Continuous Integration (CI)

- Every commit triggers automated builds and tests
- **Stages**: Lint → Type Check → Unit Tests → Integration Tests → Build
- **Tools**: GitHub Actions, GitLab CI, CircleCI, Jenkins
- **Best practice**: Keep CI fast (< 10 minutes) or developers will ignore failures

### Continuous Delivery (CD)

- Every passing build is automatically deployable to production
- **Strategies**:
  - **Blue-Green**: Two identical environments, switch traffic when ready
  - **Canary**: Gradually roll out to a percentage of users
  - **Rolling**: Update instances one at a time
  - **Feature Flags**: Deploy code hidden behind toggles, enable when ready

### Infrastructure as Code (IaC)

- Define infrastructure in version-controlled configuration files
- **Tools**: Terraform, Pulumi, AWS CDK, CloudFormation
- **Benefits**: Reproducible environments, peer review, disaster recovery

## Containerization

### Docker

- Package applications with all dependencies into portable containers
- Dockerfile best practices: multi-stage builds, minimal base images, non-root users
- Container registries: Docker Hub, GitHub Container Registry, ECR, GCR

### Kubernetes (K8s)

- Container orchestration at scale
- **Core concepts**: Pods, Deployments, Services, Ingress, ConfigMaps, Secrets
- **Managed options**: EKS (AWS), GKE (Google), AKS (Microsoft)
- **When you need it**: 10+ microservices, complex scaling requirements

### Docker Compose

- Local development and small-scale deployments
- Define multi-container applications in a single YAML file
- Perfect for development environments

## Configuration Management

### Environment Variables

- Different configs for dev, staging, production
- Never commit `.env` files to version control
- Use `.env.example` as a template

### Secret Management

- CI/CD secrets: GitHub Secrets, GitLab CI Variables
- Runtime secrets: HashiCorp Vault, AWS Secrets Manager
- Kubernetes: Sealed Secrets, External Secrets Operator

## Monitoring & Observability (DevOps Side)

### The Three Pillars

1. **Logs**: What happened? (structured logging, log aggregation)
2. **Metrics**: What are the numbers? (CPU, memory, request rate, error rate)
3. **Traces**: Where did the request go? (distributed tracing across services)

### Alerting

- Alert on symptoms, not causes (high latency, not high CPU)
- Use SLOs (Service Level Objectives) and error budgets
- PagerDuty, Opsgenie for on-call management

## Git Workflows

- **Trunk-Based Development**: Short-lived branches, frequent merges to main
- **GitFlow**: Feature branches, develop branch, release branches (more complex)
- **GitHub Flow**: Feature branches → PR → merge to main → deploy
- **Recommendation**: Trunk-based for teams practicing CI/CD

## Key Takeaways

- Automate everything that can be automated
- Your CI/CD pipeline is as important as your application code
- Deploy small changes frequently rather than big changes rarely
- Infrastructure should be disposable — if you can't recreate it in minutes, you have a problem
