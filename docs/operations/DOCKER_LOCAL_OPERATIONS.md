# Docker and Local Operations Guide

This guide covers local Docker Compose operation of the DMS. It retains React/Vite, FastAPI, PostgreSQL, and local filesystem storage; it requires no AWS resources.

## Prerequisites

- Git
- Docker Desktop or Docker Engine with Docker Compose
- PowerShell on Windows, or a POSIX-compatible shell

Run Compose commands from the repository root.

## Clean-clone setup

```sh
git clone https://github.com/kushanmalintha/aws-document-management-system.git
cd aws-document-management-system
[ -f .env ] || cp .env.example .env
[ -f backend/.env ] || cp backend/.env.example backend/.env
[ -f frontend/.env ] || cp frontend/.env.example frontend/.env
```

PowerShell alternative:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
if (-not (Test-Path frontend/.env)) { Copy-Item frontend/.env.example frontend/.env }
```

Set a unique PostgreSQL password in the root `.env` and a separate JWT secret in `backend/.env`. Generate a JWT secret with:

```sh
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Keep real values in ignored local environment files. Never commit secrets or backup files. The frontend env file is used for host-based Vite development; the Docker frontend uses the Nginx same-origin API proxy.

## Validate, build, and start

```sh
docker compose config --quiet
docker compose build --pull
docker compose up -d
docker compose ps
docker compose logs --tail=100 postgres backend frontend
```

The backend waits for PostgreSQL health, runs Alembic migrations, and starts Uvicorn only if migrations succeed. The frontend waits for backend readiness.

Default endpoints:

| Component | Address |
|---|---|
| Frontend | http://localhost:8080 |
| Backend API | http://localhost:8000 |
| API docs | http://localhost:8000/docs |
| Backend readiness | http://localhost:8000/health/ready |
| PostgreSQL | localhost:5433 |

Ports can be changed with `FRONTEND_PORT`, `BACKEND_PORT`, and `POSTGRES_PORT` in the root `.env`. Host bindings remain on 127.0.0.1. The readiness endpoint checks database connectivity. A healthy Nginx container alone does not prove application workflows work.

## Lifecycle

```sh
docker compose restart backend
docker compose restart frontend
docker compose restart postgres
docker compose stop
docker compose start
docker compose up -d --build
docker compose down
```

Ordinary stop/down operations preserve named volumes. **Do not use `docker compose down --volumes` as a normal shutdown:** it removes PostgreSQL and local document-storage data.

PostgreSQL data is held in `dms-postgres-data`; uploaded binaries are held in `dms-local-storage`, mounted at `/app/local_storage`. Restarting/recreating containers without removing volumes should preserve them. Application document deletion remains soft deletion; this phase does not add permanent file cleanup.

## Coordinated backup

For a consistent pair, stop the backend first to prevent writes. Keep PostgreSQL running.

```sh
mkdir -p backups
docker compose stop backend
docker compose exec -T postgres pg_dump -U dms_user -d dms -Fc > backups/dms-postgres.dump
docker compose run --rm --no-deps --entrypoint sh backend -c "tar -czf - -C /app local_storage" > backups/dms-local-storage.tar.gz
docker compose start backend
```

The one-off backend container reads the named storage volume while the backend service is stopped. Replace example database/user names with the actual root `.env` values. Keep the database dump and storage archive together, securely and outside the repository. A restart is not a backup.

## Restore

Restore is destructive to the target database and storage volume. Use a disposable environment first and confirm the backup pair.

1. Stop backend writes: `docker compose stop backend`.
2. Restore the database (target DB must exist):

   ```sh
   docker compose exec -T postgres pg_restore --clean --if-exists --no-owner -U dms_user -d dms < backups/dms-postgres.dump
   ```

3. Restore the storage archive using a one-off backend container:

   ```sh
   docker compose run --rm --no-deps --entrypoint sh backend -c "tar -xzf - -C /app" < backups/dms-local-storage.tar.gz
   ```

   For an exact point-in-time restore, ensure the named storage volume is empty first. Extracting over a non-empty volume does not remove files created after the backup.

4. Start and inspect:

   ```sh
   docker compose start backend
   docker compose ps
   docker compose logs --tail=100 backend
   ```

5. Verify representative document metadata and downloads.

Database metadata and document binaries must be from the same backup point. Restoring only one can create missing or orphaned files.

## Troubleshooting

- **Missing environment variables:** check root `.env` for `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`; check `backend/.env` for the JWT secret; rerun `docker compose config`.
- **Backend unhealthy:** inspect `docker compose logs --tail=200 postgres backend`; check credentials, database health, migration output, and `/health/ready`. Do not delete volumes as a shortcut.
- **Frontend unhealthy:** inspect `docker compose logs --tail=100 frontend backend` and verify backend health and image build.
- **Port conflict:** change the relevant host port in root `.env`, then run `docker compose up -d`.
- **Data appears missing:** confirm the same Compose project/directory and inspect `docker compose ps` and `docker volume ls`. Avoid `down --volumes`; a different Compose project name may create differently prefixed volumes.

## Clean-clone acceptance checklist

- [ ] Clone into a clean directory.
- [ ] Create environment files and set local secrets.
- [ ] Run `docker compose config --quiet`.
- [ ] Run `docker compose build --pull`.
- [ ] Start with `docker compose up -d`.
- [ ] Confirm all services healthy with `docker compose ps`.
- [ ] Check frontend, backend readiness, and migration logs.
- [ ] Exercise registration/login and representative folder/document workflows.
- [ ] Restart PostgreSQL/backend and verify persistence.
- [ ] Test coordinated backup/restore in a disposable environment.

Phase 7 automated backend, frontend, and PostgreSQL integration tests are separate. Container startup does not establish that test suites pass. This guide documents local operation only; it adds no AWS/cloud resources or production deployment workflow. Do not mark runtime checks complete until actually executed.
