# AWS Document Management System — Technical Decisions

This document records technical and project-management decisions agreed upon for the **AWS** Document Management System.

Each decision should include its context, rationale, consequences, and status.

Do not add proposals as approved decisions. Proposed changes must remain pending until the project owner explicitly agrees.

---

## Decision 001 — Develop Locally Before AWS Integration

**Status:** Agreed **Date:** **2026**-11-04 **Category:** Project strategy

### Context

The project is intended to teach **AWS** services through a practical application. Implementing **AWS** infrastructure before the local application is complete would introduce cloud configuration and cost concerns while core application behavior is still being verified.

### Decision

Complete and verify the application locally before beginning **AWS** integration.

### Rationale

- Allows application functionality to be tested independently of **AWS**.
- Reduces unnecessary **AWS** costs during early development.
- Makes it easier to distinguish application defects from infrastructure defects.
- Provides a stable application foundation for later cloud deployment.
- Supports a gradual, service-by-service **AWS** learning process.

### Consequences

- Local PostgreSQL remains the database during local completion.
- Local filesystem storage remains the document storage implementation during local completion.
- Docker Compose is used for local infrastructure.
- **AWS** resources are not required for local acceptance.
- **AWS** deployment work is deferred until the local completion gate.

---

## Decision 002 — Keep the Application as a Modular Monolith

**Status:** Agreed **Date:** **2026**-11-04 **Category:** Application architecture

### Context

The project report defines a deliberately small document management application and explicitly excludes microservices architecture from the baseline scope.

### Decision

Retain a modular monolith architecture using a React/Vite frontend and a FastAPI backend.

### Rationale

- The application does not require microservices to meet its baseline goals.
- A modular monolith is easier to build, run, test, and deploy for this learning project.
- It keeps the focus on **AWS** concepts rather than unnecessary distributed-system complexity.
- It preserves the original project scope.

### Consequences

- Do not split the backend into separate services without explicit approval.
- Keep application modules organized around their responsibilities.
- Use clear boundaries between **API**, business logic, persistence, and infrastructure concerns.

---

## Decision 003 — PostgreSQL Stores Metadata, Not Document Binaries

**Status:** Agreed **Date:** **2026**-11-04 **Category:** Data architecture

### Context

The original project report separates relational application data from document object storage.

### Decision

Use PostgreSQL for application and document metadata. Store document binaries in the configured storage system.

### Rationale

- Relational data and document binary storage have different responsibilities.
- PostgreSQL is suitable for user, folder, document, version, and activity metadata.
- Object storage is the intended long-term solution for document binaries.
- This separation supports the future S3 integration.

### Consequences

- Do not store document binaries directly in PostgreSQL.
- Keep document metadata associated with a storage identifier or key.
- Ensure document deletion and version management account for the corresponding stored objects.

---

## Decision 004 — Use Local Filesystem Storage During Local Completion

**Status:** Agreed **Date:** **2026**-11-04 **Category:** Storage architecture

### Context

The project must operate locally before **AWS** integration. The original report allows local storage during development.

### Decision

Use the existing local filesystem storage implementation during local completion.

### Rationale

- Avoids requiring **AWS** credentials or cloud resources for local testing.
- Makes local development easier.
- Supports testing upload, download, deletion, and storage safety.
- Provides a foundation for a later S3-backed implementation.

### Consequences

- Local storage must be verified for path safety and file handling.
- Document storage must be separated from metadata persistence.
- Future S3 integration should preserve the application's storage responsibilities and **API** behavior where practical.

---

## Decision 005 — Use Environment-Based Configuration and Keep Secrets Out of Git

**Status:** Agreed **Date:** **2026**-11-04 **Category:** Security and configuration

### Context

The application requires environment-specific settings such as database connection details and **JWT** configuration.

### Decision

Use environment configuration files for local development, provide safe `.env.example` templates, and never commit real secrets.

### Rationale

- Prevents credentials from being embedded in source code.
- Allows separate local and deployment configurations.
- Reduces the risk of exposing secrets in the repository.

### Consequences

- Real `.env` files must remain ignored.
- `.env.example` must contain placeholders only.
- Database passwords, **JWT** secrets, **AWS** credentials, and private keys must not be committed.
- Cloud runtime secrets will later use **AWS** Secrets Manager and **IAM**-based access where appropriate.
- Historical Git secret scanning remains a required verification task.

---

## Decision 006 — Use Docker Compose for Local Infrastructure

**Status:** Agreed **Date:** **2026**-11-04 **Category:** Local development

### Context

The project report identifies Docker and Docker Compose as the local containerization approach.

### Decision

Use Docker Compose to run the local frontend, backend, and PostgreSQL environment.

### Rationale

- Provides a repeatable local environment.
- Simplifies service startup and networking.
- Helps prepare the application for later container deployment.
- Supports persistent local data through volumes.

### Consequences

- Docker configuration must be verified through actual execution.
- Database and document storage persistence must be tested.
- Startup and recovery behavior must be documented.
- No claim of successful Docker execution should be made until it is tested.

---

## Decision 007 — Preserve Explicit Approval for Repository Changes

**Status:** Agreed **Date:** **2026**-11-04 **Category:** Project workflow

### Context

The project is being developed through a sequence of repository reviews and incremental tasks. The project owner wants to review proposed changes before they are applied.

### Decision

Repository files may be read and inspected without additional approval. Creating, modifying, renaming, or deleting repository files requires explicit approval of the proposed changes.

Commits and pushes require separate explicit approvals.

### Rationale

- Gives the project owner control over repository changes.
- Prevents unexpected modifications.
- Keeps each task reviewable and traceable.
- Reduces accidental scope expansion.

### Consequences

- Explain proposed changes before editing.
- Show affected files and implementation scope.
- Verify changes after implementation.
- Show a proposed commit message before committing.
- Obtain separate approval before pushing.

---

## Decision 008 — Maintain a Repository-Based Continuity Record

**Status:** Approved in principle; initial documentation content awaiting final approval **Date:** **2026**-11-04 **Category:** Project documentation and continuity

### Context

The project is expected to continue across multiple ChatGPT conversations. Relying exclusively on previous chat history could make it difficult to preserve progress and decisions.

### Decision

Use repository documentation to maintain persistent project context:

- `**AGENTS**.md`
- `docs/project/PROJECT_STATUS.md`
- `docs/project/EXECUTION_LOG.md`
- `docs/project/ARCHITECTURE_BASELINE.md`
- `docs/project/**DECISIONS**.md`
- `docs/local-completion/TASK_CHECKLIST.md`

### Rationale

- Keeps project context version-controlled.
- Makes current status and historical progress available in future sessions.
- Preserves the agreed workflow.
- Reduces dependence on chat history.

### Consequences

- These files must be kept consistent with actual repository state.
- Status and execution records must be updated after verified work.
- The continuity documentation must not claim that unapproved files have been created.
- Initial file creation is pending approval of the proposed contents.

---

## Decision Record Template

### Decision [Number] — [Title]

**Status:** Proposed / Agreed / Rejected / Superseded **Date:** **YYYY**-MM-DD **Category:** [Architecture / Security / Database / Storage / Infrastructure / Workflow / Other]

#### Context

[Explain the problem or situation.]

#### Decision

[State the agreed decision.]

#### Rationale

[Explain why the decision was selected.]

#### Consequences

- [Consequence]
- [Consequence]

#### Related files or tasks

- [File path or task ID]

---

## Decision Management Rules

## Record only decisions that have been explicitly agreed upon.

## Keep proposals separate from approved decisions. ## Do not silently change an existing decision. ## When a decision is superseded, retain the historical record and link to the replacement decision. ## Update the architecture baseline when an agreed decision changes the baseline. ## Keep decisions concise but include enough context to explain why they were made.

---

## Decision 009 — Invalidate All Existing Access Tokens on Logout Using Token Versioning

**Status:** Agreed and implemented in Phase 1  
**Date:** **2026**-11-06  
**Category:** Authentication and security

### Context

The application issues stateless JWT access tokens. A logout endpoint that only returns a successful response does not, by itself, invalidate an already issued token before its expiration.

### Decision

Use a per-user token-version value to invalidate previously issued access tokens when the user logs out.

- Persist an integer `token_version` on the user record.
- Include the current version in newly issued JWTs as the `ver` claim.
- Validate the token's version against the current user's persisted version during authenticated request processing.
- Increment the user's token version on logout.
- Reject tokens whose embedded version no longer matches the user's current version.

### Rationale

- Makes logout invalidate all previously issued access tokens for that user.
- Avoids maintaining a separate token denylist for individual access tokens.
- Keeps the mechanism compatible with the existing FastAPI and SQLAlchemy architecture.

### Consequences

- A logout invalidates all access tokens issued with the previous version for that account, not only the token presented to the logout endpoint.
- The user must authenticate again to obtain a token with the new version.
- Authentication checks require the current user record so the token version can be compared.
- The `token_version` column is introduced through Alembic migration `5f7c2a91d4e8`.
- The project owner reports that the migration and Phase 1 automated tests have been executed locally; detailed output was not included in this documentation update.

### Related files or tasks

- `backend/app/models/user.py`
- `backend/app/core/security.py`
- `backend/app/core/dependencies.py`
- `backend/app/api/auth.py`
- `backend/app/db/migrations/versions/5f7c2a91d4e8_add_user_token_version.py`
- Phase 1 — Backend Configuration and Security Foundation


---

## Decision 010 — Enforce Ownership and Core Data Invariants in PostgreSQL

**Status:** Agreed and implemented in Phase 2  
**Date:** 2026-11-10  
**Category:** Database integrity and data ownership

### Context

Application-level ownership checks are important, but the relational database should also prevent invalid ownership relationships and invalid core values from being persisted, including when data is written through a path that does not execute the usual application workflow.

### Decision

Use PostgreSQL constraints to enforce the ownership relationships and core data invariants supported by the existing data model.

- Add composite foreign-key constraints so folder, document, activity, and document-share relationships cannot cross the relevant user/document ownership boundary.
- Add check constraints for non-negative user token versions, positive document and version sizes, valid current-version values, positive version numbers, and supported document status values.
- Align applicable server defaults and nullable model declarations with the database behavior.
- Use a migration preflight to detect incompatible existing records before applying constraints. Do not silently delete or repair user data as part of the migration.
- Preserve folder deletion behavior: documents remain owned by their user and have their folder reference cleared when the folder is deleted.

### Rationale

- Makes important ownership invariants enforceable at the database boundary.
- Reduces the chance of invalid relationships being persisted by an overlooked application code path.
- Keeps data integrity in PostgreSQL, consistent with the existing architecture.
- Makes migration failure safer and more diagnosable when existing data violates the new rules.

### Consequences

- The database schema contains additional composite foreign keys and check constraints.
- Existing data must satisfy the preflight checks before the migration can complete.
- Application code and ORM relationship mappings must remain consistent with the composite constraints.
- The change does not introduce cross-service databases, microservices, AWS resources, or AWS storage integration.
- The project owner reports 24/24 local checks passing; the result is not independently reproduced in this record.

### Related files or tasks

- `backend/app/db/database.py`
- `backend/app/db/migrations/env.py`
- `backend/app/db/migrations/versions/7b2c1f8e4a91_enforce_database_integrity.py`
- `backend/app/models/`
- `backend/tests/test_database_config.py`
- `backend/tests/test_database_integrity.py`
- Phase 2 — Database Design and Data Integrity

---

## Decision 011 — Retain Deleted Documents and Physical Files Using Soft Deletion

**Status:** Agreed and implemented in Phase 3  
**Date:** 2026-11-11  
**Category:** Document lifecycle and storage retention

### Context

The document lifecycle needs a predictable deletion behavior that preserves document metadata and version history while preventing normal access to documents that a user has deleted. The local storage implementation must not silently remove physical files as a side effect of the normal document-delete operation.

### Decision

Use soft deletion for documents and retain their physical files.

- Set the document status to `DELETED` when the owner deletes it.
- Set the document's `deleted_at` timestamp.
- Exclude deleted documents from normal document listings.
- Reject normal document and version download access for deleted documents.
- Retain the document metadata and version-history records in PostgreSQL.
- Retain the physical document and version files in local storage.
- Do not expose permanent deletion or run automatic physical-file cleanup as part of Phase 3.

### Rationale

- Preserves document metadata and version history for auditability and future lifecycle decisions.
- Prevents normal application workflows from exposing a deleted document.
- Avoids an irreversible physical-file deletion as part of the ordinary delete operation.
- Keeps the behavior explicit and consistent between database state and normal application access.

### Consequences

- A deleted document remains represented in the database with status `DELETED` and a populated `deleted_at` value.
- Normal listings and downloads must consistently exclude or reject deleted documents.
- Physical files remain in local storage after soft deletion and therefore continue to consume disk space.
- Permanent deletion, retention expiry, and orphan-file cleanup require a separate future decision and implementation.
- Phase 3 manual testing must verify both access restrictions and retention of metadata, versions, and physical files.

### Related files or tasks

- `backend/app/api/documents.py`
- `backend/app/models/document.py`
- `backend/app/infrastructure/local_storage.py`
- Phase 3 — File Storage and Upload Security
