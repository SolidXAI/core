# @solidxai/core

> Turn your data models into production-grade enterprise applications — with auth, APIs, roles, and admin views — in minutes, not months.

`@solidxai/core` is the backend engine that powers every [SolidX](https://solidxai.com) application. It is a global NestJS module that wires up a complete, production-ready backend infrastructure — authentication, security, metadata-driven CRUD APIs, notifications, queues, storage providers, dashboards, and more — so you can focus on your business logic rather than rebuilding the same plumbing from scratch.

[![npm version](https://img.shields.io/npm/v/@solidxai/core)](https://www.npmjs.com/package/@solidxai/core)
[![License: BSL-1.1](https://img.shields.io/badge/License-BSL--1.1-blue.svg)](https://mariadb.com/bsl11/)
[![Documentation](https://img.shields.io/badge/docs-solidxai.com-blue)](https://docs.solidxai.com/docs)
[![Discord](https://img.shields.io/badge/discord-online-brightgreen.svg)](https://discord.gg/yh4KZf8c)


## Why @solidxai/core?

Enterprise applications share a large common surface area — auth flows, role management, CRUD endpoints, file uploads, email and SMS delivery, audit logs, and more. Most teams end up rebuilding these from scratch on every project, or stitching together a dozen separate libraries and hoping they play well together.

`@solidxai/core` solves this by bundling all of that infrastructure into a single, cohesive NestJS module that is:

- **Open-source and standards-based** — built on NestJS, TypeORM, and TypeScript. No black box, no proprietary runtime.
- **Non-prescriptive** — The code it provides is yours to extend and modify, not locked behind a code generation layer. Use it as a foundation, not a constraint.
- **Batteries included** — covers the full stack of enterprise concerns so you are not left hunting for a compatible queue library, a storage abstraction, or a permissions guard.


## Core Capabilities

### Identity & Access Management (IAM)

A complete IAM system is registered automatically when you import the module.

- **Users** — full user lifecycle management including registration, email verification, password reset and built-in protections such as password hashing, account lockout, and JWT-based access/refresh tokens.
- **Roles & Permissions** — RBAC where every controller handler is automatically discoverable as a permission; assign permissions to roles and roles to users
- **Row-Level Security Rules** — define role-aware record access policies automatically enforced at the repository layer.

### Authentication

Multiple authentication strategies available out of the box, all issuing standard JWT tokens:

- **Password-based** — bcrypt hashing, forgot/reset password flows
- **OTP / Passwordless** — one-time password login via SMS or email
- **Google OAuth2** — full Google OAuth2 flow, with redirect handling and JWT issuance
- **Token Management** — access/refresh token authentication with configurable expiry and Redis-backed refresh token storage (with in-memory fallback if Redis is not configured).

### Metadata-driven CRUD Engine

The heart of the platform. Define your data model in metadata (modules → models → fields) and get a fully functional REST API immediately.

- **Generic CRUDService** — field-aware create, update, read, and delete that understands 20+ semantic field types (relations, media, computed fields, pseudo-foreign keys, and more)
- **Filtering, sorting & pagination** — every list endpoint supports rich filter expressions, multi-column sorting, group by functionality and pagination
- **Import & Export** — Excel (`.xlsx`) and CSV import/export for every resource, with async job tracking
- **Audit trail** — automatic `created_by`, `updated_by`, and change history, configurable per model
- **Soft delete** — configurable per model, with security-aware filter application
- **Saved filters** — users can persist named query configurations against any resource
- **Computed fields** — define fields whose values are derived at persistence time (concat, UUID external IDs, sequence numbers, and custom computation)

### Notifications

A unified notification layer with provider abstractions so you can swap providers without touching application code.

- **Email** — SMTP support; Handlebars-based template management with attachment support
- **SMS** — Twilio and MSG91
- **WhatsApp** — MSG91 and 3Sixty
- **Queue-backed delivery** — all notifications are dispatched asynchronously; choose between RabbitMQ, or a database-backed queue depending on your infrastructure

### Storage

- **Media management** — upload, store, retrieve, and serve files through a unified media entity
- **Provider abstraction** — local disk and AWS S3 are supported; switch providers via configuration with no code changes
- **AWS Textract** — built-in OCR service for document extraction use cases

### Dashboards

A SQL-driven dashboard builder that lets you compose analytical views without a separate BI tool.

- **Dashboard → Questions → Variables** model for composing charts and data tables
- **SQL dataset configs** — write raw SQL, bind dynamic variables at query time
- **Security-aware aggregates** — `count`, `sum`, `avg`, `min`, `max` all respect the active user's security rules
- **Chart types** — bar, line, pie, doughnut, data table, meter group

### Chatter

- Per-record messaging thread and activity feed
- Useful for collaboration workflows, approval chains, and record-level audit commentary

### Scheduler

- Define and manage cron jobs at runtime via the admin API — no deployments required to add or modify scheduled tasks
- Jobs are stored in the database and executed by the built-in scheduler service, which can be run in a separate process if desired

### CLI Tooling

The module ships a `solidctl` package that provides a suite of command-line tools for common development and maintenance tasks:

```bash
npx @solidxai/solidctl seed                  # Seed application metadata i.e system modules, roles, and permissions, user accounts, and more
npx @solidxai/solidctl test-data             # Load test data fixtures
npx @solidxai/solidctl run-tests             # Execute metadata-driven test scenarios
npx @solidxai/solidctl generate module       # Create/Update boilerplate for a specific module
npx @solidxai/solidctl generate model        # Create/Update boilerplate for a specific model
npx @solidxai/solidctl fixtures-setup        # Set up test fixtures before a test run
npx @solidxai/solidctl fixtures-tear-down    # Tear down test fixtures after a test run
npx @solidxai/solidctl info                  # Display CLI and environment information
```

### Testing Framework

A metadata-driven end-to-end testing system built directly into the module. Define test scenarios in your module metadata JSON, then run them via the CLI.

- **API adapter** — executes scenarios against live REST endpoints using Axios
- **UI adapter** — drives a Playwright browser for full end-to-end UI tests
- **20+ built-in operations** — `api.request`, `ui.fill`, `assert.equals`, `assert.contains`, and more
- **Custom spec escape hatch** — drop into raw TypeScript for scenarios that need custom logic


## Installation

```bash
npm install @solidxai/core
```

### Peer dependencies

```bash
npm install \
  @nestjs/common @nestjs/core @nestjs/platform-express \
  @nestjs/typeorm @nestjs/config @nestjs/jwt @nestjs/passport \
  @nestjs/swagger @nestjs/axios @nestjs/cache-manager \
  @nestjs/event-emitter @nestjs/mongoose @nestjs/serve-static \
  nest-commander nest-winston nestjs-cls \
  typeorm typeorm-naming-strategies \
  reflect-metadata winston
```

Playwright is optional and only required if you intend to use the UI test adapter:

```bash
npm install --save-optional playwright
```


## Quick Setup

Import `SolidCoreModule` into your root application module. Because it is decorated with `@Global()`, all its exported services become available throughout your application without needing to re-import them.

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolidCoreModule } from '@solidxai/core';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      // ... your database config
    }),
    SolidCoreModule,
  ],
})
export class AppModule {}
```

For full configuration options — environment variables, storage providers, queue setup, and OAuth credentials — see the [Developer Documentation](https://docs.solidxai.com/docs).


## Technology Stack

| Concern | Technology |
|---|---|
| Framework | NestJS 10 |
| ORM | TypeORM (PostgreSQL, MS SQL) |
| Authentication | Database Authentication supporting pasword and otp login, Google OAuth2 |
| Queues | RabbitMQ · Database-backed |
| Storage | AWS S3 · Local disk |
| Email | SMTP (Nodemailer) |
| SMS / WhatsApp | Twilio · MSG91 · 3Sixty |
| Caching | Redis · In-memory (cache-manager) |
| PDF generation | Puppeteer |
| CLI | nest-commander |
| Logging | Winston |

---

## Part of the SolidX Platform

`@solidxai/core` is the backend foundation of the [SolidX](https://solidxai.com) low-code development platform. SolidX takes a metadata-first approach — you describe your application's data models, and the platform generates fully open-source, standards-based NestJS + React code that your team owns outright.

The output is not locked into a proprietary runtime. It runs on the same stack your developers already know — NestJS, TypeORM, React — and can be extended, forked, and deployed independently.

| | |
|---|---|
| Website | [solidxai.com](https://solidxai.com) |
| Documentation | [docs.solidxai.com](https://docs.solidxai.com/docs) |
| Discord | [discord.gg/yh4KZf8c](https://discord.gg/yh4KZf8c) |
| Support | support@solidxai.com |

---

## License

BSL-1.1 © [Logicloop](https://logicloop.io)
