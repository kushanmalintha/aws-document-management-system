# Phase 7 — Testing Guide

This guide describes the local commands and database-safety requirements for Phase 7. Run commands from the repository root unless stated otherwise.

## 1. Backend unit and mocked API workflow tests

Use the backend virtual environment and install the pinned requirements first:

```powershell
cd backend
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
```

This runs the normal backend suite. The PostgreSQL-only classes are skipped unless `TEST_DATABASE_URL` is set. Unit tests and mocked API workflow tests do not require the disposable PostgreSQL database.

## 2. PostgreSQL-backed tests — destructive database warning

**The PostgreSQL integration test modules drop and recreate tables in the database identified by `TEST_DATABASE_URL`. They are destructive to data in that target database.**

Before running them:

1. Start the local PostgreSQL service.
2. Create a separate, disposable database named `dms_test`.
3. Confirm that the application's normal database is still configured as `dms` (or another distinct non-test database).
4. Use the same PostgreSQL host and port as the local environment unless there is a deliberate reason otherwise.
5. Do not point `TEST_DATABASE_URL` at a shared, production, staging, or normal development database.

Example database creation (run using an administrative PostgreSQL account, replacing the role as appropriate):

```sql
CREATE DATABASE dms_test OWNER dms_user;
```

From PowerShell, in the `backend` directory:

```powershell
$env:TEST_DATABASE_URL = "postgresql+psycopg://dms_user:<TEST_DATABASE_PASSWORD>@localhost:5433/dms_test"
python -m unittest discover -s tests -p "test_database_integrity.py" -v
python -m unittest discover -s tests -p "test_api_integration.py" -v
Remove-Item Env:TEST_DATABASE_URL
```

Use the actual local test database credentials. Do not put the password in source files, shell scripts committed to Git, screenshots, or chat output. If the password contains URL-reserved characters, URL-encode it or use a safe local credential arrangement.

The tests enforce these safeguards:
- PostgreSQL driver required.
- Target database name must contain `test`.
- Target database name must differ from the configured application database name; host, port, and database identity must also differ.
- The integration modules only run their destructive setup when `TEST_DATABASE_URL` is present.

The database name check is a guardrail, not a substitute for manually confirming the target before execution.

## 3. Frontend tests and quality checks

From the repository root:

```powershell
cd frontend
npm ci
npm test
npm run lint
npm run build
```

Use Node.js 22, consistent with the frontend container image and current Vite toolchain.

## 4. Test reporting

For each command, record:
- Date and environment.
- Exact command.
- Passed, failed, and skipped test counts.
- Failure output and any fixes.
- Whether PostgreSQL-backed tests actually ran (not merely skipped).
- Remaining limitations.

Do not report a suite as passed if tests were skipped without recording that fact. Do not treat `create_all`-based integration tests as verification that Alembic migrations work from a clean database; migration verification is a separate operational check.

## 5. Scope boundaries

Phase 7 does not introduce AWS resources, change the application architecture, or replace the local filesystem storage. Docker operational reliability and recovery remain in Phase 8; broader performance and failure testing remain in Phase 9.
