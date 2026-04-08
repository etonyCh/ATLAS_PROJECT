# 4. Security (The Shield)

## Overview

Security is not a feature — it's a property of the entire system. Every layer, from code to infrastructure to human processes, must be designed with security in mind. In 2026, security is everyone's responsibility, not just the security team's.

## OWASP Top 10 (2025)

### 1. Broken Access Control

- Users can act outside their intended permissions
- **Prevention**: Enforce authorization on every request, use RBAC/ABAC

### 2. Cryptographic Failures

- Sensitive data exposed due to weak or missing encryption
- **Prevention**: Encrypt data at rest and in transit, use modern algorithms (AES-256, ChaCha20)

### 3. Injection

- SQL, NoSQL, OS command, LDAP injection attacks
- **Prevention**: Parameterized queries, input validation, ORM usage

### 4. Insecure Design

- Flaws in the architecture that can't be fixed with code patches
- **Prevention**: Threat modeling, secure design patterns, security reviews

### 5. Security Misconfiguration

- Default credentials, unnecessary features enabled, verbose error messages
- **Prevention**: Hardened defaults, infrastructure-as-code, automated scanning

### 6. Vulnerable & Outdated Components

- Using libraries with known vulnerabilities
- **Prevention**: Dependency scanning (Dependabot, Snyk), regular updates

### 7. Identification & Authentication Failures

- Weak passwords, credential stuffing, session fixation
- **Prevention**: MFA, rate limiting, secure session management, password policies

### 8. Software & Data Integrity Failures

- Insecure deserialization, unsigned CI/CD pipelines
- **Prevention**: Code signing, integrity checks, SBOMs

### 9. Security Logging & Monitoring Failures

- Attacks go undetected due to insufficient logging
- **Prevention**: Log all auth events, anomalies, and access violations

### 10. Server-Side Request Forgery (SSRF)

- Attacker tricks server into making requests to internal resources
- **Prevention**: Validate and whitelist URLs, network segmentation

## Authentication & Authorization

### Authentication (Who are you?)

- **Password-based**: bcrypt/Argon2 hashing, minimum complexity requirements
- **MFA/2FA**: TOTP (Google Authenticator), WebAuthn (passkeys), SMS (least preferred)
- **OAuth 2.0 / OIDC**: Delegated authentication via trusted providers
- **JWT**: Stateless tokens with expiration and refresh rotation

### Authorization (What can you do?)

- **RBAC** (Role-Based): Permissions assigned to roles, roles assigned to users
- **ABAC** (Attribute-Based): Decisions based on user, resource, and environment attributes
- **PBAC** (Policy-Based): Fine-grained policies (OPA, Cedar)
- **Zero Trust**: Never trust, always verify — every request is authenticated and authorized

## Infrastructure Security

### Network Security

- VPC isolation, security groups, network ACLs
- Private subnets for databases and internal services
- WAF (Web Application Firewall) for HTTP-level protection

### Secrets Management

- Never store secrets in code, config files, or environment variables in production
- Use: AWS Secrets Manager, HashiCorp Vault, Azure Key Vault
- Rotate secrets regularly and automatically

### Encryption

- **In Transit**: TLS 1.3 minimum, HSTS, certificate pinning for mobile
- **At Rest**: AES-256 for databases, object storage, and backups
- **End-to-End**: For sensitive user data (messages, files)

## Secure Development Practices

- **Threat Modeling**: STRIDE methodology during design phase
- **Code Review**: Security-focused reviews, not just functionality
- **SAST/DAST**: Static and dynamic application security testing in CI/CD
- **Dependency Scanning**: Automated vulnerability detection
- **Penetration Testing**: Regular third-party security assessments

## Key Takeaways

- Security is a process, not a product
- Assume breach — design systems that limit blast radius
- The cheapest vulnerability to fix is the one you prevent during design
- Train your team — humans are both the weakest link and the best defense
