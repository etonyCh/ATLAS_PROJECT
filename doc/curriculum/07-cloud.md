# 7. Cloud Services (The Foundation)

## Overview

In 2026, very few people buy physical servers. We "rent" them from AWS (Amazon), GCP (Google), or Azure (Microsoft). Understanding these platforms is mandatory because that's where your code actually lives.

## The Big Three

### AWS (Amazon Web Services)

- **Market share**: ~32% (largest)
- **Strengths**: Most services, most mature, largest ecosystem
- **Key services**:
  - EC2: Virtual machines
  - S3: Object storage
  - RDS: Managed databases
  - Lambda: Serverless functions
  - ECS/EKS: Container orchestration
  - CloudFront: CDN
  - DynamoDB: NoSQL database

### GCP (Google Cloud Platform)

- **Market share**: ~11%
- **Strengths**: Kubernetes (GKE), data analytics, AI/ML, global network
- **Key services**:
  - Compute Engine: Virtual machines
  - GKE: Managed Kubernetes (best-in-class)
  - Cloud Run: Serverless containers
  - BigQuery: Data warehouse
  - Cloud Storage: Object storage
  - Vertex AI: ML platform

### Azure (Microsoft)

- **Market share**: ~23%
- **Strengths**: Enterprise integration, Windows workloads, hybrid cloud
- **Key services**:
  - Virtual Machines
  - Azure Kubernetes Service (AKS)
  - Azure Functions: Serverless
  - Azure SQL Database
  - Blob Storage
  - Azure DevOps

## Core Cloud Concepts

### Compute

- **Virtual Machines (IaaS)**: Full control, you manage the OS
- **Containers**: Portable, consistent environments
- **Serverless (FaaS)**: Run code without managing servers, pay per execution
- **Managed Services**: Database, cache, queue — provider manages everything

### Storage

- **Object Storage**: S3, GCS, Blob — for files, images, backups
- **Block Storage**: EBS, Persistent Disks — for databases, VMs
- **File Storage**: EFS, Filestore — shared file systems
- **Archival**: Glacier, Coldline — cheap, slow retrieval

### Networking

- **VPC/VNet**: Isolated virtual network
- **Subnets**: Public (internet-facing) and private (internal only)
- **Security Groups / NSGs**: Firewall rules at the instance level
- **Load Balancers**: Distribute traffic across instances
- **CDN**: Edge caching for global performance

### Identity & Access

- **IAM**: Identity and Access Management
- **Principle of Least Privilege**: Grant minimum necessary permissions
- **Roles vs. Policies**: Roles are assigned, policies define permissions
- **Service Accounts**: Machine identities for applications

## Cloud Architecture Patterns

### Serverless Architecture

- API Gateway → Lambda/Cloud Run → Managed Database
- Auto-scaling to zero, pay only for what you use
- Best for: Event-driven workloads, APIs, batch processing

### Multi-Tier Architecture

- Web tier (public subnets) → App tier (private subnets) → Data tier (private subnets)
- Each tier has its own security group and scaling policy
- Best for: Traditional applications, compliance requirements

### Event-Driven Architecture

- Services communicate through events (SNS, EventBridge, Pub/Sub)
- Loose coupling, automatic scaling, fault tolerance
- Best for: Microservices, real-time processing, workflows

## Cost Optimization

- **Right-sizing**: Don't over-provision resources
- **Reserved Instances / Savings Plans**: Commit to 1-3 years for 30-70% discount
- **Spot Instances**: Use spare capacity for 60-90% discount (interruptible)
- **Auto-scaling**: Scale down during low traffic
- **Monitoring costs**: AWS Cost Explorer, GCP Billing Reports, Azure Cost Management

## Multi-Cloud & Hybrid

- **Multi-cloud**: Using multiple providers to avoid vendor lock-in
- **Hybrid cloud**: Combining on-premises infrastructure with cloud
- **Trade-off**: Complexity vs. resilience and negotiation power

## Key Takeaways

- Start with one cloud provider — learn it deeply before going multi-cloud
- Use managed services whenever possible — your time is more expensive than cloud costs
- Design for failure — cloud services do go down
- Always have an exit strategy — avoid vendor lock-in where practical
