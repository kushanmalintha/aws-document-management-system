# Testing Guide

This guide describes how to run the backend and frontend test suites and how to safely configure the PostgreSQL-backed integration tests. Run commands from the repository root unless otherwise stated.

## Backend Tests

Use Python 3.12 and install the pinned backend dependencies:

```sh
cd backend
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
```

The standard backend test discovery command runs the backend test suite. PostgreSQL-backed integration test classes require `TEST_DATABASE_URL`; without it, those tests are skipped. Unit tests and mocked API workflow tests do not require a disposable PostgreSQL database.

## PostgreSQL-backed Integration Tests — Destructive Database Warning

**The PostgreSQL integration test modules drop and recreate tables in the database identified by `TEST_DATABASE_URL`. They are destructive to data in that target database.**

Before running them:

1. Start a local PostgreSQL service.
2. Create a separate, disposable test database (for example, `dms_test`).
3. Confirm that the application's normal database is configured with a different name (for example, `dms`).
4. Manually verify the host, port, database name, and credentials in the test connection string.
5. Never point `TEST_DATABASE_URL` at a shared, production, staging, or normal development database.

Example database creation (run as a PostgreSQL administrator, adjusting the owner role as needed):

```sql
CREATE DATABASE dms_test OWNER dms_user;
```

From PowerShell, while in the `backend` directory:

```powershell
$env:TEST_DATABASE_URL = "postgresql+psycopg://dms_user:<TEST_DATABASE_PASSWORD>@localhost:5433/dms_test"
python -m unittest discover -s tests -p "test_database_integrity.py" -v
python -m unittest discover -s tests -p "test_api_integration.py" -v
Remove-Item Env:TEST_DATABASE_URL
```

Replace the placeholder with the actual test database password. Do not put credentials in source files, committed scripts, screenshots, or chat output. If the password contains URL-reserved characters, URL-encode it or use another safe local credential arrangement.

The integration tests include safeguards that require a PostgreSQL driver, a database name containing `test`, and a target database distinct from the configured application database. These checks are guardrails, not substitutes for manually verifying the connection target before execution.

## Frontend Tests and Quality Checks

Use Node.js 22 and npm. From the repository root:

```sh
cd frontend
npm ci
npm test
npm run lint
npm run build
```

- `npm test` runs the Vitest suite once.
- `npm run lint` runs ESLint.
- `npm run build` creates the production frontend bundle.

## Reporting Test Results

For each suite, record:

- Date and environment.
- Exact command executed.
- Passed, failed, and skipped test counts.
- Failure output and any fixes made.
- Whether PostgreSQL-backed tests actually ran or were skipped.
- Remaining limitations.

Do not report a suite as passed if its tests were skipped without recording that fact. Tests that create tables directly do not establish that Alembic migrations work from a clean database; migration verification is a separate operational check.

## Safety and Scope

- Use only a dedicated disposable PostgreSQL database for integration tests.
- Never run destructive integration setup against a database containing important data.
- Keep database passwords and other secrets out of source control.
- Test execution does not create or require AWS resources.
