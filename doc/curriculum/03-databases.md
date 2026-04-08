# 3. Database Systems (The Memory)

## Overview

Databases are the memory of your application. They store, organize, and retrieve the data that powers every feature. Choosing the right database and using it correctly is fundamental to building reliable systems.

## Database Types

### Relational (SQL)

- **Examples**: PostgreSQL, MySQL, SQLite, SQL Server
- **Strengths**: ACID transactions, complex queries, data integrity
- **Best for**: Financial systems, user data, anything requiring strong consistency
- **Key concepts**: Normalization, foreign keys, joins, indexes, transactions

### Document (NoSQL)

- **Examples**: MongoDB, CouchDB, Firebase Firestore
- **Strengths**: Flexible schema, horizontal scaling, fast reads/writes
- **Best for**: Content management, catalogs, rapidly evolving data models
- **Key concepts**: Collections, embedded documents, denormalization

### Key-Value

- **Examples**: Redis, DynamoDB, Memcached
- **Strengths**: Extremely fast, simple operations
- **Best for**: Caching, sessions, leaderboards, rate limiting

### Graph

- **Examples**: Neo4j, Amazon Neptune, ArangoDB
- **Strengths**: Relationship-heavy queries, pathfinding
- **Best for**: Social networks, recommendation engines, fraud detection

### Vector

- **Examples**: pgvector, Pinecone, Weaviate, Milvus
- **Strengths**: Semantic similarity search, AI/ML embeddings
- **Best for**: AI features, semantic search, recommendation systems

### Time-Series

- **Examples**: InfluxDB, TimescaleDB, Prometheus
- **Strengths**: Optimized for timestamped data, aggregation queries
- **Best for**: Monitoring, IoT, financial data, analytics

## Core Concepts

### Indexing

- B-Tree: Default for most databases, good for equality and range queries
- Hash: O(1) lookups for exact matches only
- GIN/GiST: Full-text search, JSON, arrays (PostgreSQL)
- **Rule**: Index the columns you filter, sort, and join on — but not every column

### Transactions & ACID

- **Atomicity**: All or nothing
- **Consistency**: Database moves from one valid state to another
- **Isolation**: Concurrent transactions don't interfere
- **Durability**: Committed data survives crashes

### Connection Pooling

- Opening database connections is expensive
- Use a pool (PgBouncer, connection pool in your ORM) to reuse connections
- Typical pool size: `CPU cores * 2 + number of spindles`

### Replication

- **Primary-Replica**: Writes go to primary, reads distributed across replicas
- **Multi-Primary**: Writes accepted on multiple nodes (complex conflict resolution)
- **Trade-off**: Replication lag means replicas may have stale data

### Backup & Recovery

- Full backups + WAL (Write-Ahead Log) for point-in-time recovery
- Test your restores — an untested backup is no backup at all
- RPO (Recovery Point Objective): How much data can you afford to lose?
- RTO (Recovery Time Objective): How fast must you be back online?

## ORM vs. Raw SQL

| Aspect         | ORM (SQLAlchemy, Prisma)        | Raw SQL                       |
| -------------- | ------------------------------- | ----------------------------- |
| Productivity   | High — auto-generated queries   | Lower — manual queries        |
| Performance    | Can generate suboptimal queries | Full control                  |
| Type Safety    | Excellent                       | Depends on tooling            |
| Learning Curve | Lower                           | Higher                        |
| Best For       | CRUD, standard operations       | Complex queries, optimization |

## Key Takeaways

- PostgreSQL is the default choice for relational data in 2026
- Use the right tool for the job — polyglot persistence is normal
- Always have a backup strategy before you have data to lose
- Monitor query performance — slow queries are the #1 cause of outages
