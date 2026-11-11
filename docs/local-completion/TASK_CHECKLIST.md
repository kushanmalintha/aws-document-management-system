# AWS Document Management System — Local Completion Checklist

**Objective:** Complete, test, and verify the application locally before beginning **AWS** implementation.

**Architecture baseline:** `docs/project/ARCHITECTURE_BASELINE.md`

**Project status:** `docs/project/PROJECT_STATUS.md`

**Execution history:** `docs/project/EXECUTION_LOG.md`

**Working instructions:** `**AGENTS**.md`

---

# Status Legend

- [ ] Not started
- [~] In progress
- [R] Reviewed
- [A] Awaiting approval
- [I] Implemented
- [V] Verified
- [B] Blocked
- [D] Deferred to a later phase

A task must not be marked verified until its required checks have actually been executed and evidence recorded.

A phase should be marked complete only after all mandatory tasks and its acceptance criteria are satisfied.

---

# Phase 0 — Repository Baseline and Development Environment

**Objective:** Understand the existing repository, establish a safe Git workflow, configure the local environment, and verify the baseline application setup.

## 0.1 Repository Inspection

- [x] Inspect repository structure.
- [x] Inspect root-level configuration files.
- [x] Inspect backend entry point and configuration.
- [x] Inspect frontend entry point and configuration.
- [x] Inspect Docker Compose and Dockerfiles.
- [x] Inspect existing backend tests.
- [x] Inspect existing frontend tests.
- [x] Compare the existing structure with the project report.
- [x] Record initial findings.

**Status:** Reviewed.

**Note:** This was a static inspection. It did not establish that the application starts or that tests pass.

## 0.2 Git and Repository Safety

- [x] Inspect current branch and working-tree state.
- [x] Inspect tracked, untracked, and ignored files.
- [x] Review root `.gitignore`.
- [x] Review backend and frontend ignore rules.
- [x] Check whether local environment files are tracked.
- [x] Check whether generated files or local document data are tracked.
- [x] Review Git history for accidentally committed secrets.
- [x] Run an appropriate secret scan.
- [x] Review Terraform state exclusion rules.
- [x] Review whether Terraform lock files should be tracked when Terraform dependencies are introduced.
- [x] Document repository safety corrections.
- [x] Obtain approval before making corrections.

**Status:** Completed based on the project owner's report that local Git inspection and Gitleaks scans finished without issues.

**Evidence limitation:** Detailed terminal output and Gitleaks findings summary were not supplied in the conversation. This status records the project owner's report; it does not claim independent execution by the assistant.

## 0.3 Local Environment Configuration

- [x] Review root `.env.example`.
- [x] Review backend `.env.example`.
- [x] Review frontend `.env.example`.
- [x] Identify required environment variables.
- [x] Confirm local database configuration.
- [x] Confirm **JWT** configuration.
- [x] Confirm local document storage configuration.
- [x] Confirm frontend **API** base **URL**.
- [x] Verify local `.env` file setup on the user's machine (user-reported).
- [x] Ensure local secrets are not committed through the reported Git inspection.
- [x] Document local setup instructions.

**Status:** Configuration examples and local setup instructions are documented. The project owner reported that required env-file checks passed.

## 0.4 Baseline Build and Startup

- [x] Verify required software and versions.
- [x] Install backend dependencies through the Docker image build.
- [x] Install frontend dependencies through the Docker image build.
- [x] Build the backend container image.
- [x] Build the frontend production bundle through the Docker image build.
- [x] Start PostgreSQL through Docker Compose.
- [x] Start the backend through Docker Compose.
- [x] Start the frontend through Docker Compose.
- [x] Verify backend health endpoint.
- [x] Verify frontend availability.
- [D] Verify frontend-to-backend application/API connectivity — deferred to Phase 5/6.
- [D] Record and review startup logs/errors — deferred to Phase 6.

**Status:** Verified for the Docker Compose baseline checks reported by the project owner.

**Verification note:** The project owner reported that environment/version and required env-file checks passed; Docker Compose configuration validation and image build passed; all containers were running; backend and database health checks passed; and the frontend was available. Frontend-to-backend application workflow testing, startup-log review, clean-database migration testing, and automated test suites are not claimed as verified by this task.

### Phase 0 Acceptance Criteria

- Repository structure is understood.
- Git and secret-management risks are reviewed.
- Required local environment variables are documented.
- Backend and frontend can be started locally.
- PostgreSQL connectivity is verified.
- Startup instructions are repeatable.

**Phase 0 completion decision (2026-11-04):** Phase 0 is complete based on the repository review, the project owner's report of no issues from local Git inspection and Gitleaks, documented environment configuration, and reported Docker Compose baseline verification. The frontend-to-backend application/API workflow and detailed startup-log review are explicitly deferred to later phases; they are not claimed as verified here. Clean-database migration verification and automated test execution remain in their planned later phases.

---

# Phase 1 — Backend Configuration and Security Foundation

**Objective:** Verify backend configuration, application startup, authentication security, and foundational access controls.

**Status:** Complete. The implementation was merged into `main`. The project owner reports that the Phase 1 automated tests, token-version migration verification, and outstanding review follow-ups have been completed.

**Evidence note:** Detailed local commands, test results, migration output, and exact changes addressing the review follow-ups were not supplied in this documentation update. Completion is therefore recorded as project-owner-reported, not independently reproduced by the assistant.

## 1.1 Application Configuration

- [x] Review configuration loading.
- [x] Verify environment-variable handling.
- [x] Check default values and required settings.
- [x] Ensure secrets are not hard-coded.
- [x] Check configuration validation at startup.
- [x] Review development versus production configuration behavior.
- [x] Verify safe error handling for missing configuration.

## 1.2 Authentication

- [x] Review user registration.
- [x] Review login behavior.
- [x] Review password hashing.
- [x] Verify password verification.
- [x] Verify **JWT** generation.
- [x] Verify **JWT** expiration.
- [x] Verify **JWT** signature validation.
- [x] Verify invalid and expired token rejection.
- [x] Review logout behavior.
- [x] Verify protected endpoint behavior.
- [x] Verify authentication error responses.
- [x] Implement token-version validation and account-wide access-token invalidation on logout.
- [x] Execute the Phase 1 automated test suite (project-owner-reported).

## 1.3 Authorization

- [x] Review role handling.
- [x] Review authorization dependencies.
- [x] Verify unauthenticated users cannot access protected endpoints.
- [x] Review user resource ownership checks.
- [x] Verify administrative functionality is restricted at the authorization-helper level.
- [x] Verify authorization is enforced by the backend, not only the frontend.

## 1.4 User Management

- [x] Review user registration validation.
- [x] Review duplicate email handling.
- [x] Review profile retrieval.
- [x] Review profile updates.
- [x] Review active/inactive user handling.
- [x] Verify sensitive user fields are not exposed in **API** responses.
- [x] Complete follow-up registration endpoint test coverage (project-owner-reported).

## 1.5 Phase 1 Migration and Review Follow-ups

- [x] Verify the `token_version` migration upgrade behavior (project-owner-reported).
- [x] Verify the `token_version` migration downgrade behavior (project-owner-reported).
- [x] Address the production CORS configuration review finding (project-owner-reported).
- [x] Address the registration endpoint test coverage review finding (project-owner-reported).

### Phase 1 Acceptance Criteria

- [x] Authentication implementation and Phase 1 checks completed.
- [x] Passwords use a secure password-hashing approach.
- [x] **JWT** validation and token-version revocation are implemented.
- [x] Protected routes reject invalid access.
- [x] Role authorization controls are enforced server-side; resource ownership and cross-user isolation remain subject to workflow verification in later phases.
- [x] No secrets are hard-coded.
- [x] Phase 1 implementation merged into `main`.

# Phase 2 — Database Design and Data Integrity

**Objective:** Verify the relational model, constraints, relationships, migrations, and transaction behavior.

## 2.1 Database Configuration

- [x] Review SQLAlchemy engine configuration.
- [x] Review session lifecycle.
- [x] Review connection management.
- [x] Review database error handling.
- [x] Check connection cleanup.
- [x] Verify the application uses the intended database configuration.

## 2.2 Models and Relationships

- [x] Review User model.
- [x] Review Folder model.
- [x] Review Document model.
- [x] Review DocumentVersion model.
- [x] Review Activity model.
- [x] Review optional sharing models if implemented.
- [x] Review foreign keys.
- [x] Review relationship definitions.
- [x] Review nullable fields and defaults.
- [x] Review uniqueness requirements.
- [x] Review indexes.
- [x] Check ownership relationships and data isolation.

## 2.3 Alembic Migrations

- [x] Review Alembic configuration.
- [x] Review migration history.
- [x] Verify migration metadata discovery.
- [x] Create a clean local database.
- [x] Run migrations from an empty database.
- [x] Verify database schema.
- [x] Verify migration version.
- [x] Test upgrade behavior.
- [x] Review downgrade behavior where supported.
- [x] Confirm migrations work in the Docker environment.

## 2.4 Data Integrity

- [x] Verify users cannot own invalid folders.
- [x] Verify documents cannot reference another user's folder.
- [x] Verify document versions reference valid documents.
- [x] Verify invalid relationships are rejected.
- [x] Review deletion behavior.
- [x] Review transaction boundaries.
- [x] Review duplicate and conflicting operations.
- [x] Verify timestamps and status fields.

### Phase 2 Acceptance Criteria

- [x] Database schema and constraints updated to match the reviewed implementation requirements.
- [x] Database configuration and Alembic URL handling reviewed and updated.
- [x] Ownership relationships and core data invariants enforced by database constraints.
- [x] Migration preflight checks added for invalid existing data.
- [x] Database integrity/configuration tests added.
- [x] Project owner reports 24/24 local checks passing with no issues found (owner-reported; raw command output not attached).
- [ ] Retain clean-database migration and Docker migration verification evidence with the Phase 2 test record if not already captured locally.

**Phase 2 implementation:** merged into `main` in commit `ea26ff9281f9554a445542f81f883557f544d725` (implementation commit `66b0c94a93cfa82a6b5b90eb3e6be88b3b1b9a1c`). The 24/24 result is project-owner-reported, not independently reproduced by the assistant.

---

# Phase 3 — File Storage and Upload Security

**Objective:** Implement and locally verify safe document storage, upload validation, secure file access, version handling, and the agreed document-retention lifecycle.

**Implementation status:** Implemented and merged into `main` in commit `d6e8f4728953e4f61d680eb8c6b643a72275e9c0`.

**Verification status:** Phase-level manual testing and automated backend tests were reported as passed by the project owner on 2026-11-11, with no issues found. Phase 3 is accepted. Detailed test output and case-by-case results were not supplied; PostgreSQL-backed integration coverage was not separately identified. The individual scenario checkboxes below are retained as an evidence-detail tracker and are not marked individually verified without itemized results.

## 3.1 Storage Architecture

- [I] Local filesystem storage remains behind the existing storage service boundary.
- [I] Generated storage keys are used; user-provided filenames are not used as storage paths.
- [I] Storage-key validation rejects absolute paths, traversal components, malformed separators, and symlink paths.
- [I] File creation uses exclusive creation to prevent overwrites.
- [I] Storage writes use restrictive file permissions where supported, flush and sync completed writes, and remove partial files after a write failure.
- [I] Storage reads reject unsafe keys and open files without following symlinks where the platform supports it.
- [ ] Manually verify storage directory configuration and physical file placement.
- [ ] Manually verify duplicate-name uploads do not overwrite existing files.
- [ ] Manually exercise traversal, absolute-path, and symlink rejection on the local environment.

## 3.2 Upload Validation

- [I] Allowed document extensions are loaded from backend configuration and normalized/validated.
- [I] Maximum upload size is enforced by inspecting actual file bytes.
- [I] Maximum filename length is configurable, with a default of 255 characters and an upper bound of 255.
- [I] Empty files and malformed filenames are rejected.
- [I] Basic content-signature/container checks are applied to supported formats.
- [I] SHA-256 checksums are calculated for initial uploads and uploaded versions.
- [I] Upload validation is shared by initial document uploads and version uploads.
- [I] Frontend allowed extensions are centralized in a shared configuration module; server-side validation remains authoritative.
- [ ] Manually test valid files for every supported extension.
- [ ] Manually test unsupported extensions, extension/content mismatches, empty files, oversized files, and overlong filenames.
- [ ] Verify rejected uploads do not leave document records or partial stored files.
- [ ] Confirm frontend extension hints match the backend's configured allowed extensions.

**Validation limitation:** Signature/container checks are basic format checks. They are not antivirus scanning and do not prove that a file is safe or fully valid according to its complete format specification.

## 3.3 Download Security

- [I] Existing authentication and document ownership checks are retained.
- [I] Deleted documents are rejected by normal download access.
- [I] Stored keys are validated by the storage boundary; invalid keys are handled as unavailable stored content.
- [I] Downloads remain streamed and use attachment content disposition.
- [I] Download responses include `X-Content-Type-Options: nosniff`.
- [I] Missing stored files are handled as not found.
- [ ] Manually verify downloads reproduce the original file bytes and filename.
- [ ] Manually verify unauthenticated and cross-user document/version downloads are rejected.
- [ ] Manually verify missing-file and deleted-document download behavior.

## 3.4 Version Management

- [I] Version uploads use the shared filename and content validation.
- [I] Version uploads must use the document's existing extension.
- [I] Version uploads calculate and persist SHA-256 checksums.
- [I] New version storage keys are generated uniquely; existing versions are retained.
- [ ] Manually verify initial and subsequent version uploads.
- [ ] Manually verify previous versions remain downloadable and match their original contents.
- [ ] Manually verify different-extension and cross-user version access are rejected.

## 3.5 Deletion and Retention Lifecycle

**Agreed behavior — soft deletion with file retention:**

- [I] Deletion changes the document status to `DELETED` and sets `deleted_at`.
- [I] Normal document listings exclude deleted documents.
- [I] Normal download access to deleted documents is rejected.
- [I] Document metadata and version history are retained.
- [I] Physical stored files are retained; the delete operation does not remove them.
- [ ] Manually verify deleted documents disappear from normal listings.
- [ ] Manually verify metadata, version history, and physical files remain after deletion.
- [ ] Manually verify normal document and version downloads are rejected after deletion.

Permanent deletion, physical-file cleanup, and automated orphan cleanup are not part of the agreed Phase 3 behavior.

## 3.6 Automated Tests and Failure Scenarios

- [I] Local storage tests cover binary save/read, non-overwrite behavior, missing-file handling, traversal/absolute-path rejection, symlink rejection where supported, and partial-write cleanup.
- [I] Upload-validation tests cover filename normalization, disallowed extensions, empty/oversized files, basic content mismatch, checksums, and selected supported formats.
- [I] Storage lifecycle tests cover soft-delete retention, deleted download rejection, cross-user download rejection, invalid stored keys, and download response headers.
- [V] Project owner reported that the Phase 3 automated backend tests passed (aggregate result; exact command, test count, and raw output not supplied).
- [ ] Confirm whether the reported backend test run included the relevant PostgreSQL-backed integration tests; this coverage was not separately identified in the supplied result.
- [ ] Manually exercise storage-unavailable, missing-file, and database-failure scenarios where safely reproducible, if these were not included in the owner's aggregate manual verification.
- [ ] Record failed tests, skipped tests, and platform-dependent symlink-test behavior if detailed test output becomes available.

### Phase 3 Implementation Record

- Main implementation commit: `d6e8f4728953e4f61d680eb8c6b643a72275e9c0`.
- Commit message: `Harden local document storage and upload validation`.
- Implementation includes backend storage hardening and upload validation, backend tests, shared frontend upload-extension configuration, and upload UI updates.
- No database migration, permanent deletion mechanism, antivirus scanning, or AWS integration was introduced.

### Phase 3 Verification Record and Acceptance

**Date:** 2026-11-11  
**Acceptance status:** [V] Accepted / Complete (project-owner-reported verification)

The project owner reported:

- Manual testing: Passed.
- Automated backend tests: Passed.
- Issues: No issues found.
- Additional details: None provided.

The assistant did not independently execute these tests during this documentation update. The result is recorded at phase level only. Individual scenario checkboxes above remain unmarked where case-by-case evidence was not supplied. PostgreSQL-backed integration coverage was not separately identified and is not claimed as verified.

### Phase 3 Acceptance Criteria

The implementation is merged and the project owner has reported successful phase-level manual testing and automated backend tests with no issues. Phase 3 is accepted on that aggregate report; this does not imply that unreported individual scenarios or separately identified PostgreSQL-backed integration tests were independently verified.

- [I] Local storage boundary and path-safety implementation.
- [I] Server-side upload validation and checksum calculation.
- [I] Secure document/version download behavior and soft-delete retention implementation.
- [I] Phase 3-focused automated test cases added.
- [V] Project owner reported that Phase 3 automated backend tests passed (aggregate result; detailed output not supplied).
- [ ] PostgreSQL-backed integration test execution/coverage separately confirmed; not identified in the supplied report.
- [V] Project owner reported Phase 3 manual testing passed at the aggregate phase level (individual case results not supplied).
- [ ] Detailed case-by-case storage security and failure-handling outcomes recorded.
- [V] Phase 3 acceptance decision recorded on 2026-11-11.

---

# Phase 4 — Backend Functional Completion

**Objective:** Verify and complete the backend functionality required by the application.

**Implementation status:** Phase 4A–4F implementation and associated test coverage are committed on `feature/phase-4-document-management`. This includes document rename/move, safe deletion of non-current versions, lightweight local processing, activity-history completion, API workflow tests, and static final review. The latest commit is `08131a0e1ce2e31202decf19ff1ab3ba6eb61671`. The branch has not been pushed or merged.

**Verification status:** Runtime tests have not yet been executed by the project owner. Items below that require runtime behavior or persisted PostgreSQL evidence remain unchecked until actual results are recorded. Do not treat implementation or test-file creation as proof that tests pass.


## 4.1 Folder Management

- [ ] Review folder creation.
- [ ] Review folder listing.
- [ ] Review folder rename.
- [ ] Review folder deletion.
- [ ] Review folder ownership.
- [ ] Review document behavior when a folder is deleted.
- [ ] Review nested folder behavior if supported.
- [ ] Verify invalid folder operations are rejected.

## 4.2 Document Management

- [ ] Review document upload workflow.
- [ ] Review document listing.
- [ ] Review document details.
- [ ] Review document metadata updates.
- [ ] Review document search.
- [ ] Review folder filtering.
- [ ] Review file-type filtering.
- [ ] Review sorting.
- [ ] Review document move operation.
- [ ] Review download.
- [ ] Review deletion.
- [ ] Verify user ownership throughout.

## 4.3 Document Versioning

- [ ] Review version creation.
- [ ] Review version numbering.
- [ ] Review version history.
- [ ] Review current-version handling.
- [ ] Review selected-version download.
- [ ] Review old-version deletion.
- [ ] Verify version ownership and consistency.
- [ ] Test concurrent version creation if relevant.

## 4.4 Processing Status

- [ ] Review processing status model.
- [ ] Verify valid status transitions.
- [ ] Verify upload completion behavior.
- [ ] Verify processing success behavior.
- [ ] Verify processing failure behavior.
- [ ] Verify status retrieval.
- [ ] Verify invalid status transitions are rejected.

## 4.5 Activity History

- [I] Activity recording is implemented for folder create/rename/delete; document upload/download/delete/rename/move; version upload/download/deletion; and processing completion/failure.
- [I] Authenticated activity listing supports user scoping, document filtering, and bounded pagination.
- [I] API workflow tests added for activity listing, filters, pagination, authentication, and activity generation from folder/document operations.
- [ ] Execute the activity-history tests and verify persisted records against PostgreSQL.
- [ ] Verify activity ordering and user isolation in a running PostgreSQL-backed workflow.

## 4.6 Administration and Optional Sharing

- [ ] Review admin user listing if implemented.
- [ ] Review user activation/deactivation if implemented.
- [ ] Verify administrative authorization.
- [ ] Review sharing implementation if present.
- [ ] Verify shared-user permissions if implemented.
- [ ] Verify expiry and revoke behavior if implemented.

### Phase 4 Acceptance Criteria

**Current status:** 4A–4F implementation and test-coverage changes are committed on the feature branch. Static review is complete, but runtime test execution is pending. Do not mark Phase 4 verified or complete until the backend test suite and any required PostgreSQL-backed checks have been executed and results recorded.

- Required backend workflows function correctly.
- Document and folder ownership is enforced.
- Version history is consistent.
- Processing state is meaningful and reliable.
- Activity records reflect significant operations.
- Optional features are clearly distinguished from mandatory requirements.

---

# Phase 5 — Frontend Functional Completion and Security

**Objective:** Verify the React application, user workflows, **API** integration, error handling, and frontend access controls.

## 5.1 Application Structure

- [ ] Review routing.
- [ ] Review layout and shared components.
- [ ] Review **API** service organization.
- [ ] Review authentication context.
- [ ] Review state management.
- [ ] Review loading and error components.
- [ ] Review environment-based **API** configuration.

## 5.2 Authentication UI

- [ ] Verify registration form.
- [ ] Verify login form.
- [ ] Verify form validation.
- [ ] Verify authentication state.
- [ ] Verify token handling.
- [ ] Verify logout.
- [ ] Verify protected routes.
- [ ] Verify expired session behavior.
- [ ] Verify unauthorized **API** response handling.

## 5.3 User Profile

- [ ] Verify profile retrieval.
- [ ] Verify profile display.
- [ ] Verify profile update.
- [ ] Verify validation and error handling.
- [ ] Verify optional profile picture behavior if implemented.

## 5.4 Folder UI

- [ ] Verify folder listing.
- [ ] Verify folder creation.
- [ ] Verify folder rename.
- [ ] Verify folder deletion.
- [ ] Verify navigation.
- [ ] Verify empty states.
- [ ] Verify **API** error handling.

## 5.5 Document UI

- [ ] Verify document listing.
- [ ] Verify upload.
- [ ] Verify upload progress if supported.
- [ ] Verify document details.
- [ ] Verify search.
- [ ] Verify filters.
- [ ] Verify sorting.
- [ ] Verify folder selection.
- [ ] Verify document movement.
- [ ] Verify download.
- [ ] Verify deletion.
- [ ] Verify version history.
- [ ] Verify processing status display.
- [ ] Verify empty, loading, and failure states.

## 5.6 Activity and Administration

- [ ] Verify activity history.
- [ ] Verify activity display.
- [ ] Verify admin pages if implemented.
- [ ] Verify role-based navigation.
- [ ] Verify frontend restrictions are consistent with backend authorization.

## 5.7 Frontend Security and Reliability

- [ ] Review token storage.
- [ ] Review sensitive information handling.
- [ ] Review **API** error handling.
- [ ] Review file upload validation feedback.
- [ ] Review user-controlled content rendering.
- [ ] Review route guards.
- [ ] Review session expiration.
- [ ] Review production build configuration.

### Phase 5 Acceptance Criteria

- Main user workflows are usable.
- **API** integration works.
- Errors and loading states are handled.
- Frontend navigation reflects authorization.
- Backend remains the final authority for access control.
- Production frontend build succeeds.

---

### Phase 5 Implementation Notes — 2026-11-11

The initial frontend audit found that the majority of the core screens and workflows already existed. The following implementation additions have been prepared:

- Document rename and move controls on the document details page.
- Historical-version deletion controls; the current version is not offered for deletion.
- Shared client-side upload-size feedback aligned with the backend's default 10 MiB limit. The backend remains authoritative.
- Protected-request 401 handling that clears the local access token and in-memory authentication state; login/registration credential failures are excluded.
- Email-format feedback for login and registration.
- A pending state for logout to prevent repeated submissions.
- JSON error extraction for Blob-based document downloads.
- Focused frontend tests for the new document controls, service methods, version deletion, and expired-session handling.

These are implementation notes, not test acceptance. Keep the verification checkboxes below unchecked until the corresponding frontend tests, lint, production build, and integrated workflows have actually been executed. Test execution is deferred to the agreed testing phase.

# Phase 6 — API Contract, Error Handling, and Observability

**Objective:** Ensure **API** consistency, predictable error responses, and sufficient diagnostic information.

## 6.1 API Contract

- [ ] Review **API** route organization.
- [ ] Review request schemas.
- [ ] Review response schemas.
- [ ] Review status codes.
- [ ] Review pagination.
- [ ] Review filtering and sorting parameters.
- [ ] Review **API** documentation.
- [ ] Compare implemented routes with frontend usage.
- [ ] Document actual **API** behavior.

## 6.2 Error Handling

- [ ] Review validation errors.
- [ ] Review authentication errors.
- [ ] Review authorization errors.
- [ ] Review not-found errors.
- [ ] Review conflict errors.
- [ ] Review database errors.
- [ ] Review file storage errors.
- [ ] Review unexpected exceptions.
- [ ] Ensure internal stack traces are not exposed to users.
- [ ] Ensure useful diagnostic information is retained in logs.

## 6.3 Logging

- [ ] Review logging configuration.
- [ ] Ensure passwords and tokens are not logged.
- [ ] Review request and error logging.
- [ ] Review log severity levels.
- [ ] Review sensitive data exposure.
- [ ] Verify logs are useful for troubleshooting.

## 6.4 Health and Operational Endpoints

- [ ] Review health endpoint.
- [ ] Review database readiness behavior if applicable.
- [ ] Verify health endpoint response.
- [ ] Review startup and shutdown behavior.
- [ ] Document operational requirements.

### Phase 6 Acceptance Criteria

- **API** behavior is consistent.
- Errors are predictable and safe.
- Logs are useful and do not expose secrets.
- Health checks accurately represent application readiness.

---

# Phase 7 — Backend, Frontend, and Integration Testing

**Objective:** Establish evidence that the application behaves correctly across individual components and integrated workflows.

## 7.1 Backend Tests

- [ ] Review existing backend test configuration.
- [ ] Run existing backend tests.
- [ ] Add or improve authentication tests where needed.
- [ ] Add authorization tests.
- [ ] Add user isolation tests.
- [ ] Add folder workflow tests.
- [ ] Add document workflow tests.
- [ ] Add versioning tests.
- [ ] Add storage security tests.
- [ ] Add activity tests.
- [ ] Add database integrity tests.
- [ ] Record results.

## 7.2 Frontend Tests

- [ ] Review existing frontend test configuration.
- [ ] Run existing frontend tests.
- [ ] Verify authentication context tests.
- [ ] Verify protected route tests.
- [ ] Verify login and registration tests.
- [ ] Verify document workflow tests.
- [ ] Verify folder workflow tests.
- [ ] Verify profile tests.
- [ ] Verify activity tests.
- [ ] Verify **API** service tests.
- [ ] Add missing tests where justified.
- [ ] Record results.

## 7.3 Integration Tests

- [ ] Test registration and login.
- [ ] Test authenticated **API** access.
- [ ] Test folder creation and listing.
- [ ] Test document upload and listing.
- [ ] Test document download.
- [ ] Test document deletion.
- [ ] Test version creation and retrieval.
- [ ] Test activity recording.
- [ ] Test user isolation across accounts.
- [ ] Test invalid and unauthorized requests.
- [ ] Test database and storage failure behavior where practical.

## 7.4 Regression Testing

- [ ] Run backend tests after changes.
- [ ] Run frontend tests after changes.
- [ ] Run relevant integration tests.
- [ ] Review failures.
- [ ] Fix approved regressions.
- [ ] Record the final results.

### Phase 7 Acceptance Criteria

- Relevant backend tests pass.
- Relevant frontend tests pass.
- Critical user workflows pass integration testing.
- User isolation is verified.
- Test failures and limitations are documented.

---

# Phase 8 — Docker and Local Operational Reliability

**Objective:** Ensure a clean local environment can be built, started, persisted, and recovered using Docker Compose.

## 8.1 Dockerfiles

- [ ] Review backend Dockerfile.
- [ ] Review frontend Dockerfile.
- [ ] Review base images.
- [ ] Review dependency installation.
- [ ] Review build stages.
- [ ] Review container users and permissions.
- [ ] Review exposed ports.
- [ ] Review runtime commands.
- [ ] Ensure secrets are not included in images.

## 8.2 Docker Compose

- [ ] Review service definitions.
- [ ] Review networks.
- [ ] Review volumes.
- [ ] Review environment configuration.
- [ ] Review health checks.
- [ ] Review service dependencies.
- [ ] Verify localhost port exposure.
- [ ] Verify container-to-container connectivity.
- [ ] Start the full stack.
- [ ] Inspect container logs.

## 8.3 Persistence and Recovery

- [ ] Verify PostgreSQL data survives container restart.
- [ ] Verify document storage survives container restart.
- [ ] Verify application can reconnect to PostgreSQL.
- [ ] Verify behavior after backend restart.
- [ ] Verify behavior after frontend restart.
- [ ] Verify behavior after database restart.
- [ ] Test recovery after an unexpected container stop.
- [ ] Document backup and recovery considerations.

## 8.4 Clean-Clone Verification

- [ ] Clone the repository into a clean directory.
- [ ] Follow the documented setup instructions.
- [ ] Configure local environment files.
- [ ] Start the system.
- [ ] Run migrations.
- [ ] Run relevant tests.
- [ ] Verify main user workflows.
- [ ] Record missing or unclear setup instructions.

### Phase 8 Acceptance Criteria

- Docker Compose can start the local application.
- Persistent data survives expected restarts.
- The system recovers from ordinary container restarts.
- A clean clone can be configured using the documentation.

---

# Phase 9 — Performance, Reliability, and Failure Testing

**Objective:** Identify significant local performance and reliability issues and verify important failure paths.

## 9.1 Performance Review

- [ ] Review inefficient database queries.
- [ ] Review unnecessary database round trips.
- [ ] Review list pagination.
- [ ] Review large document handling.
- [ ] Review memory usage during uploads and downloads.
- [ ] Review frontend rendering and request behavior.
- [ ] Identify obvious bottlenecks.
- [ ] Apply only justified and approved optimizations.

## 9.2 Reliability Testing

- [ ] Test database unavailable behavior.
- [ ] Test storage unavailable behavior.
- [ ] Test invalid upload behavior.
- [ ] Test interrupted upload behavior.
- [ ] Test missing document behavior.
- [ ] Test concurrent update behavior where relevant.
- [ ] Test database/storage partial failure behavior.
- [ ] Test application restart behavior.

## 9.3 Data Consistency

- [ ] Review metadata and file consistency.
- [ ] Review document deletion consistency.
- [ ] Review version consistency.
- [ ] Review activity consistency.
- [ ] Review failed operation cleanup.
- [ ] Document unresolved limitations.

### Phase 9 Acceptance Criteria

- Major failure paths are understood.
- Data consistency risks are addressed or documented.
- No significant known reliability defect is left unreviewed.
- Performance changes are evidence-based.

---

# Phase 10 — Code Quality, Dependency Security, and Documentation

**Objective:** Improve maintainability and ensure the project documentation reflects the actual implementation.

## 10.1 Code Quality

- [ ] Review backend organization.
- [ ] Review frontend organization.
- [ ] Identify duplicated logic.
- [ ] Identify unnecessary complexity.
- [ ] Review naming and consistency.
- [ ] Review error-handling consistency.
- [ ] Review unused code and dependencies.
- [ ] Review code formatting and linting.
- [ ] Apply justified improvements with approval.

## 10.2 Dependency Security

- [ ] Review backend dependencies.
- [ ] Review frontend dependencies.
- [ ] Check for known vulnerabilities.
- [ ] Review outdated dependencies.
- [ ] Review package lock files.
- [ ] Assess severity and applicability of findings.
- [ ] Plan safe upgrades.
- [ ] Verify the application after dependency changes.

## 10.3 Documentation

- [ ] Review root **README**.
- [ ] Document prerequisites.
- [ ] Document environment setup.
- [ ] Document local startup.
- [ ] Document database migrations.
- [ ] Document test execution.
- [ ] Document Docker usage.
- [ ] Document repository structure.
- [ ] Document actual **API** behavior.
- [ ] Document troubleshooting.
- [ ] Document local storage behavior.
- [ ] Ensure planned **AWS** features are clearly marked as planned.
- [ ] Remove or replace inaccurate default template documentation.

## 10.4 Repository Consistency

- [ ] Verify environment examples.
- [ ] Verify ignore rules.
- [ ] Verify no secrets are staged.
- [ ] Verify no unintended generated files are committed.
- [ ] Verify documentation links and file paths.
- [ ] Verify project status and execution log are current.

### Phase 10 Acceptance Criteria

- Code quality issues have been reviewed.
- Dependency security findings have been assessed.
- Setup and operation documentation is accurate.
- Documentation does not claim unimplemented functionality.

---

# Phase 11 — Final Local Acceptance and AWS Readiness Gate

**Objective:** Perform the final local verification and decide whether the application is ready to proceed to **AWS** learning stages.

## 11.1 Final Functional Acceptance

- [ ] Registration works.
- [ ] Login works.
- [ ] Logout works.
- [ ] Profile workflows work.
- [ ] Folder workflows work.
- [ ] Document upload works.
- [ ] Document listing works.
- [ ] Search and filtering work where implemented.
- [ ] Document download works.
- [ ] Document deletion works.
- [ ] Version workflows work where implemented.
- [ ] Processing status behavior works.
- [ ] Activity history works.
- [ ] Administration features work where implemented.
- [ ] Optional sharing works if included.

## 11.2 Final Security Acceptance

- [ ] Password hashing verified.
- [ ] **JWT** validation verified.
- [ ] Authentication verified.
- [ ] Authorization verified.
- [ ] User data isolation verified.
- [ ] Upload validation verified.
- [ ] Storage path safety verified.
- [ ] Sensitive data not exposed in logs.
- [ ] Secrets excluded from repository.
- [ ] Historical secret scan reviewed.
- [ ] No unresolved critical or high-severity security findings without an explicitly accepted and documented exception.

## 11.3 Final Operational Acceptance

- [ ] Clean-clone setup verified.
- [ ] Database migrations verified.
- [ ] Backend tests executed.
- [ ] Frontend tests executed.
- [ ] Integration tests executed.
- [ ] Docker Compose startup verified.
- [ ] Persistence verified.
- [ ] Restart and recovery behavior verified.
- [ ] **README** and setup documentation verified.
- [ ] Known limitations documented.

## 11.4 AWS Readiness Review

- [ ] Local application is stable.
- [ ] Configuration is environment-based.
- [ ] Storage responsibilities are separated.
- [ ] Database and object storage responsibilities are separated.
- [ ] Backend is suitable for container deployment.
- [ ] Health and logging behavior are understood.
- [ ] **AWS** target architecture is documented.
- [ ] **AWS** cost and cleanup approach is understood.
- [ ] **AWS** implementation plan is reviewed.
- [ ] Project owner approves moving to **AWS** stages.

### Phase 11 Acceptance Criteria

The local application is considered ready for **AWS** learning only when:

## Required local functionality is verified.

## Database migrations work from a clean state. ## Relevant backend and frontend tests pass. ## Critical integrated workflows pass. ## Authentication, authorization, and user isolation are verified. ## Upload and storage security are verified. ## Docker startup and persistence are verified. ## Documentation reflects the actual implementation. ## No unresolved critical or high-severity security issue remains without an explicitly accepted exception. ## The project owner approves the AWS transition.

---

# AWS Implementation — Deferred

The following **AWS** stages belong to the later cloud learning roadmap. They are not part of the 12-phase local completion checklist.

## AWS account safety, MFA, budget, and CLI.

2. **IAM**.
## VPC networking.
## EC2 learning deployment.
## RDS PostgreSQL.
## S3 document storage.
7. **ECR**.
## ECS and Fargate.
## Application Load Balancer.
## Secrets Manager.
11. **SQS**.
## Lambda.
13. **SNS**.
## CloudWatch.
## CloudTrail.
## CloudFront.
## Route 53.
18. **ACM**.
## Terraform.
## GitHub Actions.
## Final deployment verification and cost-safe cleanup.

**AWS** stages must follow the original project report and must include a resource cleanup procedure.

Do not create **AWS** resources during local completion unless the project owner explicitly changes this scope.

---

# Checklist Maintenance Rules

## Update an item only when its actual status changes.

## Use Reviewed when code has been inspected but not changed. ## Use Approved only after explicit approval. ## Use Implemented after approved changes have been made. ## Use Verified only after the required checks have actually passed. ## Record failed checks and blockers. ## Keep the project status file synchronized with the checklist. ## Append implementation and verification evidence to the execution log. ## Do not mark a phase complete while mandatory acceptance criteria remain unmet. ## Obtain explicit approval before repository modifications, commits, pushes, or the transition to AWS implementation.
