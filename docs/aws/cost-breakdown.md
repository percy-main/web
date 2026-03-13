# Cost Breakdown

All prices: eu-west-2 (London) region, USD. Based on ~200 members, typical traffic of a few hundred requests/day with spikes during fantasy cricket gameweeks.

---

## Compute — ECS Fargate

The API service runs on ARM/Graviton-based Fargate tasks. Production runs 2 tasks for availability during rolling deployments and to handle concurrent requests. Staging runs 1 task.

| Item | Spec | Unit Price | Monthly |
|------|------|-----------|---------|
| vCPU (prod, 2 tasks) | 0.25 vCPU × 2 | $0.03725/vCPU-hr | $13.60 |
| Memory (prod, 2 tasks) | 0.5 GB × 2 | $0.00409/GB-hr | $2.99 |
| vCPU (staging, 1 task) | 0.25 vCPU | $0.03725/vCPU-hr | $6.80 |
| Memory (staging, 1 task) | 0.5 GB | $0.00409/GB-hr | $1.49 |
| **Subtotal** | | | **$24.88** |

Scheduled ECS tasks (data pipelines) run on-demand and cost fractions of a cent per execution at this scale.

---

## Networking

### NAT Gateway

ECS tasks in private subnets require a NAT Gateway to reach external services (Stripe, Play Cricket, SES, Slack). Each environment requires its own NAT Gateway within its VPC.

| Item | Unit Price | Monthly |
|------|-----------|---------|
| NAT Gateway (prod) | $0.048/hr | $35.04 |
| NAT Gateway (staging) | $0.048/hr | $35.04 |
| Data processing (prod, ~10 GB/mo) | $0.048/GB | $0.48 |
| Data processing (staging, ~5 GB/mo) | $0.048/GB | $0.24 |
| **Subtotal** | | **$70.80** |

### Application Load Balancer

Required for routing traffic to ECS tasks and performing health checks.

| Item | Unit Price | Monthly |
|------|-----------|---------|
| ALB (prod) | $0.02646/hr | $19.32 |
| ALB (staging) | $0.02646/hr | $19.32 |
| LCU usage (low traffic) | ~$0.01/hr | ~$1.00 |
| **Subtotal** | | **$39.64** |

### VPC Endpoints

S3 Gateway endpoints are free and avoid routing S3 traffic through the NAT Gateway.

| Item | Unit Price | Monthly |
|------|-----------|---------|
| S3 Gateway endpoint (prod) | Free | $0 |
| S3 Gateway endpoint (staging) | Free | $0 |
| **Subtotal** | | **$0** |

### Cross-AZ Data Transfer

| Item | Rate | Monthly |
|------|------|---------|
| ECS ↔ RDS (if cross-AZ) | $0.01/GB each way | ~$1.00 |

---

## Database — RDS PostgreSQL

Single-AZ instances are appropriate for our availability requirements. Automated backups provide data durability.

| Item | Spec | Unit Price | Monthly |
|------|------|-----------|---------|
| Instance (prod) | db.t4g.micro, single-AZ | $0.018/hr | $13.14 |
| Instance (staging) | db.t4g.micro, single-AZ | $0.018/hr | $13.14 |
| Storage (prod) | 20 GB gp3 | $0.133/GB | $2.66 |
| Storage (staging) | 20 GB gp3 | $0.133/GB | $2.66 |
| Backup storage | Within free allocation | $0 | $0 |
| **Subtotal** | | | **$31.60** |

---

## Secrets & Configuration

| Item | Approach | Monthly |
|------|----------|---------|
| SSM Parameter Store (Standard) | ~20 params × 2 envs | **$0** (free for up to 10,000 standard parameters) |
| Secrets Manager | 2–4 secrets requiring rotation (e.g., RDS credentials) | **$0.80–1.60** ($0.40/secret/month) |
| **Subtotal** | | **~$1.00** |

---

## Logging & Monitoring — CloudWatch

| Item | Estimate | Unit Price | Monthly |
|------|----------|-----------|---------|
| Log ingestion (prod, ~2 GB/mo) | 2 GB | $0.5985/GB | $1.20 |
| Log ingestion (staging, ~1 GB/mo) | 1 GB | $0.5985/GB | $0.60 |
| Log storage (6 months retention, ~15 GB cumulative) | 15 GB | $0.0315/GB | $0.47 |
| Custom metrics | First 10 free | $0 | $0 |
| Alarms (health checks, error rates) | First 10 free | $0 | $0 |
| Dashboards | First 3 free | $0 | $0 |
| Additional metrics/alarms/dashboards | ~20 metrics, ~15 alarms, 2 extra dashboards | Various | ~$10.00 |
| **Subtotal** | | | **~$12.27** |

---

## Frontend Hosting — S3 + CloudFront

| Item | Estimate | Unit Price | Monthly |
|------|----------|-----------|---------|
| S3 storage (frontend + assets, ~5 GB) | 5 GB | $0.024/GB | $0.12 |
| CloudFront transfer | ~20 GB/mo (within 1 TB free tier) | Free | $0 |
| CloudFront HTTPS requests | ~500k/mo (within 10M free tier) | Free | $0 |
| S3 origin fetch requests | ~50k/mo | $0.00042/1k GET | $0.02 |
| **Subtotal** | | | **~$0.14** |

---

## Email — SES

| Item | Estimate | Unit Price | Monthly |
|------|----------|-----------|---------|
| Outbound emails | ~500/mo | $0.10/1,000 | $0.05 |
| **Subtotal** | | | **~$0.05** |

---

## DNS — Route 53

| Item | Count | Unit Price | Monthly |
|------|-------|-----------|---------|
| Hosted zone | 1 | $0.50/zone | $0.50 |
| Queries | ~100k/mo | $0.40/million | $0.04 |
| **Subtotal** | | | **~$0.54** |

---

## Container Registry — ECR

| Item | Estimate | Unit Price | Monthly |
|------|----------|-----------|---------|
| Image storage (5 images retained) | ~1 GB | $0.10/GB | $0.10 |
| **Subtotal** | | | **~$0.10** |

---

## WAF

| Item | Count | Unit Price | Monthly |
|------|-------|-----------|---------|
| Web ACL | 1 | $5.00/mo | $5.00 |
| Rules | 5 | $1.00/rule | $5.00 |
| Requests | ~500k/mo | $0.60/million | $0.30 |
| **Subtotal** | | | **~$10.30** |

---

## Elastic IPs

| Item | Notes | Monthly |
|------|-------|---------|
| EIP for NAT Gateway (prod) | Included in NAT Gateway cost | $0 |
| EIP for NAT Gateway (staging) | Included in NAT Gateway cost | $0 |
| **Subtotal** | | **$0** |

---

## EventBridge + Lambda (Scheduling)

| Item | Notes | Monthly |
|------|-------|---------|
| EventBridge rules | ~5 rules | Free |
| Lambda invocations (trigger ECS tasks) | ~500/mo | Free (1M/mo free tier) |
| **Subtotal** | | **$0** |

---

## Cost Summary — Production + Staging

| Category | Monthly Cost |
|----------|-------------|
| NAT Gateway (2 envs) | $70.80 |
| ALB (2 envs) | $39.64 |
| RDS PostgreSQL (2 envs) | $31.60 |
| ECS Fargate (2 envs, 3 tasks total) | $24.88 |
| CloudWatch (logs, metrics, alarms) | $12.27 |
| WAF | $10.30 |
| Secrets Manager | $1.00 |
| Cross-AZ transfer | $1.00 |
| Route 53 | $0.54 |
| S3 + CloudFront | $0.14 |
| ECR | $0.10 |
| SES | $0.05 |
| EventBridge + Lambda | $0 |
| SSM Parameter Store | $0 |
| **Total** | **~$192/month** |

## Cost Summary — Production Only

| Category | Monthly Cost |
|----------|-------------|
| NAT Gateway | $35.28 |
| ALB | $19.82 |
| RDS PostgreSQL | $15.80 |
| ECS Fargate (2 tasks) | $16.59 |
| CloudWatch | $7.00 |
| WAF | $10.30 |
| Everything else | $2.83 |
| **Total** | **~$108/month** |

---

## Cost Drivers

| Rank | Service | Monthly (2 envs) | % of Total | Notes |
|------|---------|-----------------|------------|-------|
| 1 | **NAT Gateway** | $70.80 | 37% | Conscious simplicity trade-off: required for private subnet outbound access. Alternatives (fck-nat, NAT instances) reduce cost but add operational burden. We accept the managed NAT cost to keep networking simple and reliable. One per VPC. |
| 2 | **ALB** | $39.64 | 21% | Required for ECS service routing and health checks. One per environment. |
| 3 | **RDS** | $31.60 | 16% | Always-on instances. |
| 4 | **ECS Fargate** | $24.88 | 13% | Application compute. |
| 5 | **CloudWatch** | $12.27 | 6% | Grows with monitoring maturity. |
| 6 | **WAF** | $10.30 | 5% | Recommended for application security. |
| 7 | **Everything else** | $2.83 | 1% | S3, CloudFront, SES, Route 53, ECR, SSM, EventBridge |

---

## Cost Optimisation Options

| Option | Potential Savings | Trade-off |
|--------|------------------|-----------|
| **Single RDS instance** for prod + staging (separate databases) | ~$16/mo | Shared resource; staging load could affect production |
| **Fargate Spot** for staging tasks | ~$8/mo | Tasks can be interrupted (acceptable for non-production) |
| **Reserved Instances** for RDS (1-year no-upfront) | ~30% on RDS (~$10/mo) | Upfront commitment |
| **Compute Savings Plans** (1-year) | ~20% on Fargate (~$5/mo) | Upfront commitment |
| **Share NAT Gateway** across prod + staging via VPC peering | ~$35/mo | Cross-account networking complexity |

---

## Phased Cost Build-Up

Infrastructure is provisioned incrementally. Not all costs are incurred from day one:

| Phase | New AWS Services Added | Incremental Monthly Cost | Cumulative Monthly Cost |
|-------|----------------------|-------------------------|------------------------|
| **Phase 1: Foundation & Database** | RDS (prod), Route 53, SES, S3, VPC + NAT (prod) | ~$50 | ~$50 |
| **Phase 2: Backend Service** | ECS Fargate (prod, 2 tasks), ALB (prod), ECR, CloudWatch, WAF | ~$58 | ~$108 |
| **Phase 3: Data Pipelines** | ECS scheduled tasks (on-demand, minimal cost) | ~$1 | ~$109 |
| **Phase 4: Frontend Migration** | CloudFront (frontend) — mostly within free tier | ~$1 | ~$110 |
| **Phase 5: Content Migration** | No new services (uses existing RDS + S3) | $0 | ~$110 |
| **Phase 6: Staging & Cutover** | RDS (staging), ECS (staging, 1 task), ALB (staging), NAT (staging), CloudWatch (staging) | ~$83 | ~$193 |

The initial migration (Phases 1–2) runs on approximately **$108/month**. Full production + staging with all services reaches approximately **$193/month**.

---

## Annual Cost Projection

| Scenario | Monthly | Annual |
|----------|---------|--------|
| Production + Staging (full plan) | ~$192 | ~$2,304 |
| Production only (initial phase) | ~$108 | ~$1,296 |

Costs are conservative estimates based on current usage patterns. Actual costs may be lower in early phases before all services are provisioned, and may increase modestly as monitoring and pipeline maturity grows.

---

## Credits Request

Based on the infrastructure plan above, we are requesting AWS non-profit credits to cover:

### Year 1: Migration + Full Infrastructure

| Item | Annual Cost |
|------|-----------|
| **Steady-state infrastructure** (production + staging) | ~$2,300 |
| **Migration experimentation** (parallel running during cutover, testing instance sizes and configurations) | ~$700 |
| **Year 1 total** | **~$3,000** |

### Year 2+: Steady-State + Growth

| Item | Annual Cost |
|------|-----------|
| **Steady-state infrastructure** | ~$2,300 |
| **Growth headroom** | ~$500 |
| **Year 2+ total** | **~$2,800** |

Growth headroom accounts for specific scaling triggers: if membership doubles (~400 members), RDS scales to db.t4g.small and ECS adds a third task. Expanded monitoring (additional CloudWatch dashboards, metrics, alarms) also grows modestly with operational maturity.

A credit allocation of **$5,000/year** would cover our planned infrastructure across both the migration year and subsequent steady-state operations, with room for the growth scenarios above.
