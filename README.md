# AWS Document Management System

A learning-focused document management application built with React, FastAPI, and PostgreSQL. The project is being developed locally first, with AWS integration planned as a later stage.

## Overview

The system allows registered users to organize documents into folders, upload and manage document versions, download their files, and review activity history. The backend owns authentication, authorization, metadata integrity, upload validation, and access to stored files.

**Current implementation:** the application runs locally using Docker Compose, PostgreSQL, and filesystem-based document storage. AWS services are not integrated yet.

## Features

- User registration, login, logout, and authenticated routes.
- User profile viewing and display-name updates.
- Folder creation, listing, renaming, nesting, and deletion.
- Document upload, listing, search, filtering, and sorting.
- Document rename and movement between folders or the root.
- Authenticated document downloads.
- Document version uploads, version history, and deletion of non-current historical versions.
- Soft deletion of documents, retaining their metadata, versions, and stored files.
- Activity history for document and folder operations.
- Document processing status with background checksum verification.
- Request validation, standardized API errors, request IDs, and structured application logging.

## Technology Stack

| Area | Technology |
|---|---|
| Frontend | React 19, Vite, React Router, Axios |
| Backend | Python 3.12, FastAPI, Pydantic |
| Database | PostgreSQL 17, SQLAlchemy, Alembic |
| Authentication | JWT bearer access tokens, Argon2 password hashing |
| File storage | Local filesystem storage through a storage service abstraction |
| Local deployment | Docker, Docker Compose, Nginx |
| Frontend testing | Vitest, React Testing Library |
| Backend testing | Python unittest-based unit, API workflow, and PostgreSQL integration tests |

## Current Architecture

```text
Browser
  |
  v
React frontend (Vite in development / Nginx in Docker)
  |
  | HTTP API requests
  v
FastAPI backend
  |                 |
  v                 v
PostgreSQL      Local document storage
(users,         (uploaded file binaries
folders,         and version files)
documents,
versions,
activities)
```

Docker Compose runs three services:

- **PostgreSQL:** stores users, folders, document metadata, version metadata, and activity records.
- **Backend:** exposes the FastAPI REST API, applies database migrations at container startup, validates uploads, enforces access controls, and reads/writes document files.
- **Frontend:** serves the production React build through Nginx and proxies API requests to the backend.

Document binaries are stored outside PostgreSQL. The local storage service uses generated storage keys rather than user-supplied paths. PostgreSQL data and document files are persisted in separate named Docker volumes.

## Main Backend Areas

The backend is organized under `backend/app`:

- `api/` — authentication, users, folders, documents, and activity endpoints.
- `core/` — configuration, security dependencies, logging, and API error/request observability.
- `db/` — SQLAlchemy database setup and Alembic migrations.
- `models/` — database entities.
- `schemas/` — request and response schemas.
- `services/` — activity recording, document processing, storage, and upload validation.
- `infrastructure/` — infrastructure adapters; the local filesystem adapter is implemented, while the AWS package is currently a placeholder.

## Repository Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/migrations/
│   │   ├── infrastructure/
│   │   ├── models/
│   │   ├── schemas/
│   │   └── services/
│   ├── tests/
│   ├── .env.example
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── config/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/
│   │   └── styles/
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
├── docs/
│   └── testing/
├── infrastructure/
│   └── terraform/       # Reserved for planned AWS infrastructure
├── lambda/              # Reserved for planned AWS functions
├── scripts/
├── tests/
├── .github/
├── .env.example
├── docker-compose.yml
└── README.md
```

The `infrastructure/terraform` and `lambda` directories are placeholders; they do not mean AWS resources or Lambda functions have been deployed.

## Prerequisites

For the recommended Docker-based setup:

- Git
- Docker Desktop, or Docker Engine with the Docker Compose plugin

For running components directly on the host:

- Python 3.12
- Node.js 22 and npm
- A PostgreSQL instance

## Local Environment Setup

The repository includes example environment files. Create local copies from the repository root.

**macOS / Linux / Git Bash:**

```sh
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

If a local environment file already exists, do not overwrite it. Retain its values and add any newly required settings manually.

Update the following values before starting the application:

- In the root `.env`, replace the example `POSTGRES_PASSWORD` with a unique, strong local database password.
- In `backend/.env`, set `POSTGRES_PASSWORD` to the same database password.
- In `backend/.env`, replace `JWT_SECRET_KEY` with a separate randomly generated secret.

Generate a JWT secret using Python:

```sh
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Do not reuse the database password as the JWT secret. Keep real credentials in local ignored `.env` files; never commit secrets.

### Environment file roles

| File | Purpose |
|---|---|
| `.env` | Docker Compose PostgreSQL credentials and host port mappings |
| `backend/.env` | FastAPI settings, database connection, JWT, CORS, upload limits, and local storage |
| `frontend/.env` | Vite development API URL when running the frontend directly |

The backend CORS setting, `CORS_ALLOWED_ORIGINS`, must contain explicit HTTP(S) origins. The example includes the local Vite and Docker frontend origins. Update it to the exact trusted origins when changing local ports or deploying elsewhere.

## Run with Docker Compose (Recommended)

Run these commands from the repository root after configuring the environment files:

```sh
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
```

The backend waits for PostgreSQL to become healthy, runs Alembic migrations, and then starts Uvicorn. The frontend waits for backend readiness.

Default local addresses:

| Component | Address |
|---|---|
| React application | http://localhost:8080 |
| FastAPI API | http://localhost:8000 |
| Interactive API documentation | http://localhost:8000/docs |
| Backend readiness check | http://localhost:8000/health/ready |
| PostgreSQL | localhost:5433 |

The frontend is served by Nginx and uses a same-origin API proxy. Host ports can be changed through `FRONTEND_PORT`, `BACKEND_PORT`, and `POSTGRES_PORT` in the root `.env`.

Useful commands:

```sh
# Follow service logs
docker compose logs -f

# Restart services
docker compose restart

# Stop and remove containers/network (preserves named volumes)
docker compose down

# Rebuild images and recreate services
docker compose up -d --build
```

**Data warning:** `docker compose down` preserves the named PostgreSQL and document-storage volumes. `docker compose down --volumes` removes those volumes and permanently deletes the corresponding local database and uploaded-file data.

## Run Components Directly (Development)

The Docker Compose workflow is the recommended way to start the complete system. To work on the frontend or backend separately, start PostgreSQL independently and configure the backend to connect to it.

### Backend

From the repository root:

```sh
cd backend
python -m venv .venv
```

Activate the environment:

```sh
# macOS / Linux / Git Bash
source .venv/bin/activate

# Windows PowerShell
.venv\Scripts\Activate.ps1
```

Install dependencies and start the API:

```sh
python -m pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

The backend reads its settings from `backend/.env`. For direct host execution, the example database host and port are `localhost:5433`, matching the default PostgreSQL host mapping in Docker Compose.

### Frontend

Open a separate terminal:

```sh
cd frontend
npm ci
npm run dev
```

The Vite development server uses `VITE_API_BASE_URL` from `frontend/.env` (default `http://localhost:8000`). Vite prints the frontend URL when it starts.

## Testing and Quality Checks

Backend tests:

```sh
cd backend
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
```

Frontend tests and checks:

```sh
cd frontend
npm ci
npm test
npm run lint
npm run build
```

PostgreSQL-backed backend integration tests require a separate disposable test database configured through `TEST_DATABASE_URL`. These tests drop and recreate tables in that database. Never point this variable at a normal development, staging, or production database. Read [Testing Guide](docs/testing/TESTING.md) before running the PostgreSQL integration tests.

Running a command is not evidence that it passed; review and record its actual output. Docker startup and API health checks do not replace automated test execution.

## Security and Data Handling

- Passwords are hashed with Argon2; plaintext passwords are not stored.
- Authenticated API routes use JWT bearer access tokens.
- Public registration assigns the standard user role; a role is not accepted from public registration input.
- Backend ownership checks protect user folders, documents, and downloads. Frontend route guards are not the security boundary.
- Upload validation checks allowed extensions, filename constraints, file size, empty files, and basic file-content signatures/structure.
- Stored file names/keys are generated by the backend. The local storage layer validates storage keys and prevents unsafe path traversal.
- Document binaries are stored in the local filesystem volume; metadata and version records are stored in PostgreSQL.
- Document deletion is soft deletion. The document is hidden from normal listings and downloads, while its metadata, version history, and physical files are retained.
- The current browser frontend stores its bearer access token in localStorage. This is not equivalent to an HttpOnly cookie; protecting the application against cross-site scripting remains important.
- The document-processing task currently uses FastAPI in-process background tasks. It verifies stored file checksums; it is not a durable queue or a full content-extraction/antivirus pipeline.

These controls describe the current implementation and should not be interpreted as a complete production security certification.

## AWS Learning Stage (Planned)

AWS is the next planned project stage, not part of the current running application. The repository has reserved locations for future AWS infrastructure and backend adapters, but no AWS resources or cloud integrations are described as implemented here.

The AWS phase will be planned and implemented separately, building on the local application and its storage abstraction. AWS services, deployment topology, IAM permissions, networking, observability, and cost controls will be documented as they are actually introduced.

## Documentation

- [Testing Guide](docs/testing/TESTING.md)

