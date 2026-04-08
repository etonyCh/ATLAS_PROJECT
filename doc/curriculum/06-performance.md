# 6. Performance Optimization (The Tuning)

## Overview

Performance optimization is about making your application fast and responsive. When traffic hits your site, a load balancer acts like a traffic cop, routing users to different servers so no single server gets overwhelmed. This is critical for high availability.

## Load Balancing

### Types

- **Layer 4 (Transport)**: Routes based on IP and port (TCP/UDP)
- **Layer 7 (Application)**: Routes based on HTTP headers, cookies, paths
- **Global Server Load Balancing (GSLB)**: Routes across geographic regions

### Algorithms

- **Round Robin**: Distribute evenly across servers
- **Least Connections**: Send to the server with fewest active connections
- **IP Hash**: Same user always goes to the same server (session affinity)
- **Weighted**: Assign different capacities to different servers

### Tools

- **Cloud**: AWS ALB/NLB, GCP Load Balancing, Azure Load Balancer
- **Self-hosted**: NGINX, HAProxy, Traefik, Envoy

## Caching Strategies

### Browser Cache

- Static assets (JS, CSS, images) cached on the user's device
- Cache-Control headers: `max-age`, `immutable`, `no-cache`
- Service Workers for offline support and custom caching

### CDN (Content Delivery Network)

- Edge servers worldwide serve content from the nearest location
- **Providers**: CloudFront, Cloudflare, Fastly, Vercel Edge Network
- **What to cache**: Static assets, API responses, images, videos

### Application Cache

- **In-memory**: Redis, Memcached for frequently accessed data
- **Cache-Aside**: Check cache first, fall back to database
- **Write-Through**: Write to cache and database simultaneously
- **TTL (Time-To-Live)**: How long cached data remains valid

### Database Query Cache

- Cache expensive query results
- Invalidate on data changes
- PostgreSQL: pg_stat_statements for query analysis

## Database Performance

### Indexing

- Add indexes on columns used in WHERE, JOIN, ORDER BY
- Avoid over-indexing (slows down writes)
- Use `EXPLAIN ANALYZE` to understand query plans

### Query Optimization

- N+1 query problem: Fetch related data in a single query (JOINs, DataLoader)
- Pagination: Never return unbounded result sets
- Denormalization: Sometimes duplicating data is faster than joining

### Connection Management

- Connection pooling to avoid connection overhead
- Read replicas for read-heavy workloads
- Connection timeouts and retry logic

## Frontend Performance

### Core Web Vitals

- **LCP (Largest Contentful Paint)**: < 2.5s — loading performance
- **INP (Interaction to Next Paint)**: < 200ms — interactivity
- **CLS (Cumulative Layout Shift)**: < 0.1 — visual stability

### Optimization Techniques

- Code splitting: Load only what's needed for the current page
- Image optimization: WebP/AVIF formats, responsive images, lazy loading
- Tree shaking: Remove unused code from bundles
- Compression: Gzip, Brotli for text-based assets
- HTTP/2 or HTTP/3: Multiplexed connections, header compression

## Backend Performance

### Async Processing

- Offload heavy tasks to background workers (Celery, BullMQ)
- Email sending, image processing, report generation
- Return immediate response, process asynchronously

### Profiling

- **APM tools**: New Relic, Datadog, Sentry Performance
- **Language-specific**: cProfile (Python), Chrome DevTools (JS), pprof (Go)
- **Database**: Slow query logs, EXPLAIN plans, pg_stat_statements

### Scaling

- **Vertical**: Bigger machines (limited ceiling)
- **Horizontal**: More machines (virtually unlimited)
- **Auto-scaling**: Scale based on metrics (CPU, memory, request count)

## Key Takeaways

- Measure before optimizing — guesswork leads to wasted effort
- The fastest code is the code that never runs (eliminate, don't optimize)
- Caching is the most effective performance optimization
- Performance is a feature — users notice and care about speed
