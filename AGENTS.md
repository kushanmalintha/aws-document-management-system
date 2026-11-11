# Project Working Instructions — AWS Document Management System

## 1. Project Purpose

This repository contains the **AWS** Document Management System (**DMS**), an independent, learning-focused application intended to provide practical experience with software development, cloud infrastructure, deployment, security, and **AWS** operations.

The project must be developed and verified locally before implementing the **AWS** deployment stages.

The original project report is the authoritative source for the intended system requirements and target architecture:

- `**AWS**-Document-Management-System-Project-Report.md` (original report supplied by the project owner; its repository location must be confirmed if it is to be stored in the repository).
- `docs/project/ARCHITECTURE_BASELINE.md` (maintained summary of the report).

Do not redesign the application or introduce unnecessary architectural complexity.

## 2. Project Technology Stack

### Local application

- Frontend: React and Vite
- Backend: Python and FastAPI
- Database: PostgreSQL
- **ORM**: SQLAlchemy
- Database migrations: Alembic
- Local file storage: filesystem-based storage
- Local orchestration: Docker Compose
- Version control: Git and GitHub

### Intended AWS learning stack

The eventual **AWS** learning roadmap includes:

- **IAM**
- **VPC**
- **EC2**
- **ECR**
- **ECS** with Fargate
- Application Load Balancer
- **RDS** PostgreSQL
- S3
- **SQS**
- Lambda
- **SNS**
- Secrets Manager
- CloudWatch
- CloudTrail
- CloudFront
- Route 53
- **ACM**
- **AWS** Budgets
- Terraform
- GitHub Actions

These **AWS** services must not be introduced into the local application merely to complete local development. Their implementation belongs to the later **AWS** learning stages.

## 3. Architecture Rules

## Keep the application as a modular monolith unless the project owner explicitly approves an architectural change.

## Keep React as the frontend and FastAPI as the backend. ## Use PostgreSQL for relational application data. ## Store document binaries in the configured storage system, not directly in PostgreSQL. ## Keep document metadata and document binary storage responsibilities separate. ## Use a storage abstraction or clear service boundary so local filesystem storage can later be replaced or supplemented by S3 storage. ## Keep environment-specific configuration outside source code. ## Do not hard-code credentials, passwords, tokens, or secret keys. ## Preserve the existing project structure unless a justified and approved change is necessary. ## Do not add microservices, Kubernetes, or other infrastructure that is not required by the approved architecture.

## 4. Mandatory Development Workflow

Follow this workflow for every task.

### Step 1 — Read the current project context

Before beginning a task, inspect:

- `**AGENTS**.md`
- `docs/project/PROJECT_STATUS.md`
- The latest relevant entries in `docs/project/EXECUTION_LOG.md`
- `docs/project/ARCHITECTURE_BASELINE.md`
- `docs/project/**DECISIONS**.md`
- `docs/local-completion/TASK_CHECKLIST.md`
- The relevant current source files in the GitHub repository

Use the current GitHub repository as the source for the latest implementation.

Do not rely only on previous chat messages or assumptions about the repository.

### Step 2 — Understand the task

- Identify the exact checklist item being addressed.
- Read relevant implementation files and their dependencies.
- Identify existing behavior.
- Compare the implementation with the requirements.
- Identify possible regressions and security implications.
- Check whether another existing component already provides the required functionality.

### Step 3 — Present the review

Before changing files, explain:

## What the current implementation does.

## What is already correct. ## What is missing or incorrect. ## Why a change is necessary. ## Which files need to be changed. ## What exact changes are proposed. ## How the changes will be verified.

Keep the scope limited to the current task.

### Step 4 — Obtain explicit approval

Reading and reviewing repository files is permitted without additional approval.

However, before creating, modifying, renaming, or deleting repository files, obtain the project owner's explicit approval for the proposed changes.

Do not interpret a general request to complete a task as automatic permission to modify files.

If the proposed scope changes materially after approval, explain the difference and obtain approval again.

### Step 5 — Implement approved changes

After approval:

- Change only the approved files and scope.
- Follow the existing code style and architecture.
- Avoid unrelated refactoring.
- Preserve existing functionality.
- Do not introduce **AWS** dependencies during local completion.
- Do not introduce unnecessary packages.
- Do not remove existing functionality without approval.
- Do not create placeholder implementations that appear complete but are not functional.

### Step 6 — Verify the implementation

After implementation:

- Inspect the updated files.
- Run relevant automated checks if the available tools permit.
- Identify checks that could not be executed.
- For tests requiring the user's local machine, Docker environment, or credentials, provide exact commands and ask the user to execute them.
- Review the user's output before marking the task verified.
- Record actual test results, including failures.

Never claim that a test, build, migration, container, or deployment succeeded unless it was actually executed and its result was observed.

### Step 7 — Update project records

After implementation and verification:

- Update `docs/project/PROJECT_STATUS.md`.
- Append a dated entry to `docs/project/EXECUTION_LOG.md`.
- Update `docs/local-completion/TASK_CHECKLIST.md` only according to the actual task status.
- Update `docs/project/**DECISIONS**.md` only when a technical decision has actually been agreed upon.

Do not mark an item complete merely because code was written.

### Step 8 — Commit approval

Before committing:

## Show the changed file list.

## Summarize the changes. ## Show the proposed commit message. ## Ask for explicit permission to commit.

Do not commit before approval.

### Step 9 — Push approval

Before pushing:

## Explain what will be pushed.

## Identify the target branch. ## Ask for explicit permission to push.

Do not push before approval.

## 5. Task Status Definitions

Use the following statuses consistently:

- **Not Started** — Work has not begun.
- **In Progress** — Work is currently being investigated or implemented.
- **Reviewed** — Relevant implementation has been inspected and findings documented.
- **Awaiting Approval** — Proposed changes have been presented but not approved.
- **Approved** — The project owner has approved the proposed changes.
- **Implemented** — Approved changes have been made.
- **Awaiting Verification** — Implementation exists but required checks have not been completed.
- **Verified** — Required checks have been executed successfully and evidence is recorded.
- **Blocked** — Work cannot proceed because of an identified dependency or issue.
- **Committed** — Changes have been committed after approval.

A task can be reviewed without being implemented. A task can be implemented without being verified.

## 6. Git and Secret Management

Never commit:

- `.env` files containing real values
- Database passwords
- **JWT** secrets
- **AWS** access keys
- Private keys
- Tokens
- Personal credentials
- Terraform state files
- Other confidential configuration

Maintain `.env.example` files with safe placeholder values.

Before committing:

- Inspect the changed files.
- Inspect the Git diff.
- Check for accidentally included secrets.
- Confirm ignored files are not staged.
- Check that generated files and local data are not unintentionally included.

Do not assume that a clean `.gitignore` proves the Git history contains no secrets. Historical secret scanning is a separate verification task.

## 7. Local-First Rule

The project must reach the local acceptance criteria before **AWS** implementation begins.

During local completion:

- Use local PostgreSQL.
- Use local document storage.
- Use Docker Compose where appropriate.
- Verify application behavior without **AWS** credentials.
- Keep configuration flexible enough for future **AWS** integration.
- Do not create billable **AWS** resources.

**AWS** work must begin only after the local completion gate has been reviewed and explicitly approved by the project owner.

## 8. Testing and Evidence

Testing must be evidence-based.

For every test result, record:

- Test name or command
- Environment
- Date
- Result
- Relevant output or failure
- Any remaining limitation

Distinguish between:

- Static code inspection
- Automated unit tests
- Integration tests
- Docker/runtime tests
- Manual functional tests
- Security checks
- **AWS** deployment tests

These are not interchangeable.

## 9. Documentation Rules

Keep project documentation consistent with the actual implementation.

- Do not document planned functionality as implemented.
- Clearly label planned **AWS** functionality.
- Record important technical decisions and their rationale.
- Keep the execution log historical and append-only where practical.
- Update current status when task progress changes.
- Preserve the original project report's requirements unless a change is explicitly agreed upon.

## 10. Scope Control

For each task:

- Address the current checklist item.
- Do not silently combine unrelated tasks.
- Do not perform broad refactoring without a reason.
- Do not change the target architecture without approval.
- Raise contradictions between the original report and the existing implementation before deciding how to resolve them.

## 11. Continuation Between Chat Sessions

When continuing this project in a new ChatGPT conversation:

## Read this file.

## Read the current project status. ## Read the latest execution log entries. ## Read the architecture baseline and decisions. ## Read the task checklist. ## Inspect the current repository state. ## Identify the next incomplete task. ## Explain the next task and proposed scope before making changes.

Do not assume that a previous conversation's proposed changes were implemented, verified, committed, or pushed.

## 12. Current Project Priority

The current priority is:

**Phase 4 implementation is merged into main but still awaits runtime verification. Phase 5 implementation is committed on its feature branch and awaits the dedicated testing phase. Phase 6 — API Contract, Error Handling, and Observability is implemented on its feature branch and awaits static review and commit approval; tests remain deferred.**

Continue local-first development. Do not introduce AWS resources or integration during Phases 4–11. Phase 4A–4F implementation and backend test coverage were merged into `main` by PR #8 (merge commit `368864d4cf90d0dbc985ed07cbfb212356c21c75`); Phase 4 runtime verification remains pending. Phase 5 was committed on `feature/phase-5-frontend-functional-completion` in commit `a908c531b7bb4fe309d8e4a5a1ab79212f5ecd3e`; tests, lint, and build remain deferred. Phase 6 was committed on `feature/phase-6-api-error-observability` in commit `6d9173b3620c2c03cd3dbc58ede5e187e2f71ee4` (`Implement API error handling and observability`). The branch is not merged into `main`; all tests, lint, build, and runtime verification remain deferred. Do not claim runtime verification until evidence is recorded.

The project owner must approve repository changes, commits, pushes, merges, and any AWS transition separately.
