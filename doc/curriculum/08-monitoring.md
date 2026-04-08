# 8. Monitoring (The Pulse)

## Overview

If a server goes down at 3:00 AM, how do you know? Monitoring tools show you the "health" of your system in real-time so you can fix bugs before users even notice. Monitoring is your eyes and ears in production.

## The Three Pillars of Observability

### 1. Logs (What happened?)

- Structured logs with consistent format (JSON)
- **Tools**: ELK Stack (Elasticsearch, Logstash, Kibana), Loki, CloudWatch Logs
- **Best practices**:
  - Include: timestamp, level, service, request_id, user_id
  - Log at the right level: DEBUG, INFO, WARN, ERROR, FATAL
  - Never log sensitive data (passwords, tokens, PII)

### 2. Metrics (What are the numbers?)

- Numerical measurements over time
- **Tools**: Prometheus (data collection), Grafana (visual dashboards), Datadog
- **The Four Golden Signals** (Google SRE):
  - **Latency**: Time to serve a request
  - **Traffic**: Requests per second
  - **Errors**: Failed requests per second
  - **Saturation**: How "full" your system is (CPU, memory, disk)

### 3. Traces (Where did the request go?)

- Follow a single request across multiple services
- **Tools**: Jaeger, Zipkin, AWS X-Ray, OpenTelemetry
- **Key concepts**: Spans, trace ID, parent-child relationships
- **Best for**: Debugging distributed systems, finding bottlenecks

## Monitoring Tools

### Prometheus + Grafana

- **Prometheus**: Pull-based metrics collection, powerful query language (PromQL)
- **Grafana**: Beautiful dashboards, alerting, multiple data sources
- **Best for**: Self-hosted, open-source, highly customizable

### Datadog

- All-in-one: APM, logs, metrics, infrastructure monitoring
- **Best for**: Teams that want a managed solution with minimal setup
- **Trade-off**: Expensive at scale

### New Relic

- Full-stack observability platform
- **Best for**: Application performance monitoring, business analytics

### Sentry

- Error tracking with stack traces, user context, and release tracking
- **Best for**: Catching and debugging errors in production

## Alerting

### Alert Design Principles

- Alert on **symptoms**, not causes (high error rate, not high CPU)
- Every alert must be **actionable** — if you can't do anything about it, it's not an alert
- Use **severity levels**: P0 (immediate), P1 (urgent), P2 (normal), P3 (low)
- **Avoid alert fatigue**: Too many alerts = ignored alerts

### SLOs, SLIs, and SLAs

- **SLI (Service Level Indicator)**: What you measure (e.g., 99.9% of requests succeed)
- **SLO (Service Level Objective)**: Your target (e.g., 99.9% uptime per month)
- **SLA (Service Level Agreement)**: Contract with users (e.g., 99.9% uptime or refund)
- **Error Budget**: The amount of downtime you're allowed (0.1% = ~43 minutes/month)

### On-Call Best Practices

- Rotate on-call duties fairly
- Provide clear runbooks for common alerts
- Post-mortems for every incident — blameless, focused on learning
- Compensate on-call time appropriately

## Dashboards

### Essential Dashboards

1. **System Overview**: CPU, memory, disk, network across all services
2. **Application Performance**: Request rate, latency, error rate by endpoint
3. **Database Health**: Query performance, connection pool, replication lag
4. **Business Metrics**: Active users, signups, revenue, key user journeys

### Dashboard Design

- Start with the most important metric at the top
- Use appropriate visualizations (time series for trends, gauges for current state)
- Include context (annotations for deployments, incidents)
- Keep it simple — a dashboard with 50 panels is a dashboard with 0 insights

## Incident Response

### Incident Lifecycle

1. **Detection**: Alert fires or user reports issue
2. **Triage**: Assess severity, assign owner
3. **Mitigation**: Restore service (fix can come later)
4. **Resolution**: Root cause identified and fixed
5. **Post-Mortem**: Document what happened, why, and how to prevent it

### Runbooks

- Step-by-step guides for common incidents
- Include: symptoms, diagnosis steps, resolution steps, escalation path
- Keep them updated — outdated runbooks are worse than no runbooks

## Key Takeaways

- If you can't measure it, you can't improve it
- Monitor in production — staging never matches production exactly
- Start with the Four Golden Signals before adding complexity
- A good monitoring system tells you about problems before your users do
