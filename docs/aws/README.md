# AWS Migration — Percy Main Community Sports Club

## About This Project

Percy Main CSC is a registered non-profit community sports club based in North Tyneside, England. We serve ~200 members through a web application handling membership subscriptions, payment processing, fantasy cricket, match statistics, and club administration.

Our infrastructure is currently spread across several third-party services (Netlify, Turso, Mailgun, Contentful), funded personally by a trustee. We are proposing a migration to AWS to consolidate onto a single, professional platform — and are applying for AWS non-profit credits to support this.

## Documents

| Document | Description |
|----------|-------------|
| [Proposal](./proposal.md) | Architecture overview, services being replaced, key benefits, and broad timeline |
| [Implementation Plan](./implementation-plan.md) | Detailed phased migration plan with technical specifics |
| [Cost Breakdown](./cost-breakdown.md) | Line-by-line AWS service costs, phased build-up, and credits request |
| [Infrastructure as Code](./infrastructure-as-code.md) | Terraform approach: module design, state management, CI/CD, and phasing |
| [Monorepo Structure](./monorepo.md) | Workspace layout, shared code strategy, tooling options, CI/CD pipelines, and Docker |

## Summary

- **Current monthly cost:** Spread across Netlify, Turso, Mailgun, and Contentful — funded personally
- **Proposed monthly cost on AWS:** ~$108 (production only) to ~$193 (production + staging)
- **Proposed annual cost:** ~$2,300 steady-state
- **Credits request:** $5,000/year (covers infrastructure + growth headroom)
- **Migration phases:** 6 phases, incremental — production services online from Phase 2
