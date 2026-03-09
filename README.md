# @solidxai/core

> Turn your data models into production-grade enterprise applications — with auth, APIs, roles, and admin views — in minutes, not months.

`@solidxai/core` is the backend engine that powers every [SolidX](https://solidxai.com) application. It is a global NestJS module that wires up a complete, production-ready backend infrastructure — authentication, security, metadata-driven CRUD, notifications, queues, storage, dashboards, and more — so you can focus on your business logic rather than rebuilding the same plumbing from scratch.

[![npm version](https://img.shields.io/npm/v/@solidxai/core)](https://www.npmjs.com/package/@solidxai/core)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Documentation](https://img.shields.io/badge/docs-solidxai.com-blue)](https://docs.solidxai.com/docs)

---

## Why @solidxai/core?

Enterprise applications share a large common surface area — auth flows, role management, CRUD endpoints, file uploads, email and SMS delivery, audit logs, and more. Most teams end up rebuilding these from scratch on every project, or stitching together a dozen separate libraries and hoping they play well together.

`@solidxai/core` solves this by bundling all of that infrastructure into a single, cohesive NestJS module that is:

- **Open-source and standards-based** — built on NestJS, TypeORM, and TypeScript. No black box, no proprietary runtime.
- **Non-prescriptive** — add it to any existing NestJS project. The code it provides is yours to extend and modify.
- **Batteries included** — covers the full stack of enterprise concerns so you are not left hunting for a compatible queue library, a storage abstraction, or a permissions guard.

---

## Core Capabilities

### Identity & Access Management (IAM)

A complete IAM system is registered automatically when you import the module.

- **Users** — full user lifecycle management including registration, email verification, password reset, and account blocking on repeated failed login attempts
- **Roles & Permissions** — RBAC where every controller handler is automatically discoverable as a permission; assign permissions to roles and roles to users
- **Row-level Security Rules** — define record-level access rules tied to the active user's role, enforced transparently at the repository layer via `SolidBaseRepository`

### Authentication

Multiple authentication strategies available out of the box, all issuing standard JWT tokens:

- **Password-based** — bcrypt hashing, forgot/reset password flows
- **OTP / Passwordless** — one-time password login via SMS or email
- **Google OAuth2** — full OAuth2 flow with redirect handling and JWT issuance
- **Token management** — access token + refresh token pattern with configurable expiry and Redis-backed refresh token storage

### Metadata-driven CRUD Engine

The heart of the platform. Define your data model in metadata (modules → models → fields) and get a fully functional REST API immediately.

- **Generic CRUDService** — field-aware create, update, read, and delete that understands 20+ semantic field types (relations, media, computed fields, pseudo-foreign keys, and more)
- **Filtering, sorting & pagination** — every list endpoint supports rich filter expressions, multi-column sorting, and cursor/offset pagination
- **Import & Export** — Excel (`.xlsx`) and CSV import/export for every resource, with async job tracking
- **Audit trail** — automatic `created_by`, `updated_by`, and change history, configurable per model
- **Soft delete** — configurable per model, with security-aware filter application
- **Saved filters** — users can persist named query configurations against any resource
- **Computed fields** — define fields whose values are derived at persistence time (concat, UUID external IDs, sequence numbers, and custom providers)

### Notifications

A unified notification layer with provider abstractions so you can swap providers without touching application code.

- **Email** — SMTP (Nodemailer) and Elastic Email; Handlebars-based template management with attachment support
- **SMS** — Twilio and MSG91
- **WhatsApp** — MSG91 and 3Sixty
- **Queue-backed delivery** — all notifications are dispatched asynchronously; choose between RabbitMQ, Redis, or a database-backed queue depending on your infrastructure

### Storage

- **Media management** — upload, store, retrieve, and serve files through a unified media entity
- **Provider abstraction** — local disk and AWS S3 are supported; switch providers via configuration with no code changes
- **AWS Textract** — built-in OCR service for document extraction use cases

### Dashboards

A SQL-driven dashboard builder that lets you compose analytical views without a separate BI tool.

- **Dashboard → Questions → Variables** model for composing charts and data tables
- **SQL dataset configs** — write raw SQL, bind dynamic variables at query time
- **Multiple output formats** — Chart.js and PrimeReact DataTable / MeterGroup data providers
- **Security-aware aggregates** — `count`, `sum`, `avg`, `min`, `max` all respect the active user's security rules

### Chatter

- Per-record messaging thread and activity feed, similar to the chatter panel in platforms like Salesforce or Odoo
- Useful for collaboration workflows, approval chains, and record-level audit commentary

### Scheduler

- Define and manage cron jobs at runtime via the admin API — no deployments required to add or modify scheduled tasks
- Jobs are stored in the database and executed by the built-in `SchedulerServiceImpl`

### CLI Tooling

The module ships a `solidCore` binary for common development and maintenance tasks:

```bash
solidCore seed                  # Seed module and permission metadata
solidCore test-data             # Load test data fixtures
solidCore run-tests             # Execute metadata-driven test scenarios
solidCore refresh-model         # Regenerate boilerplate for a specific model
solidCore refresh-module        # Regenerate boilerplate for a specific module
solidCore fixtures-setup        # Set up test fixtures before a test run
solidCore fixtures-tear-down    # Tear down test fixtures after a test run
solidCore ingest                # Ingest data into the knowledge base
solidCore mcp                   # Start the MCP server
solidCore info                  # Display CLI and environment information
```

### Testing Framework

A metadata-driven end-to-end testing system built directly into the module. Define test scenarios in your module metadata JSON, then run them via the CLI.

- **API adapter** — executes scenarios against live REST endpoints using Axios
- **UI adapter** — drives a Playwright browser for full end-to-end UI tests (Playwright is an optional peer dependency)
- **20+ built-in operations** — `api.request`, `ui.fill`, `assert.equals`, `assert.contains`, and more
- **Token interpolation** — pass values between test steps using a simple `{{variable}}` syntax
- **Custom spec escape hatch** — drop into raw TypeScript for scenarios that need custom logic

---

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

---

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

---

## Technology Stack

| Concern | Technology |
|---|---|
| Framework | NestJS 10 |
| ORM | TypeORM (PostgreSQL, MySQL) + Mongoose (MongoDB) |
| Authentication | Passport.js — JWT, Local, Google OAuth2 |
| Queues | RabbitMQ · Redis · Database-backed |
| Storage | AWS S3 · Local disk |
| Email | SMTP (Nodemailer) · Elastic Email |
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
| Support | support@solidxai.com |

---

## License

ISC © [Logicloop](https://logicloop.io)
