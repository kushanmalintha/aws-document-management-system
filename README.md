# AWS Document Management System

A learning-focused Document Management System built locally first and progressively migrated to AWS.

## Project Goals

The project is designed to learn and apply:

- Python
- FastAPI
- React
- PostgreSQL
- Docker
- Git/GitHub
- Amazon S3
- Amazon RDS
- Amazon ECS/Fargate
- Amazon ECR
- Application Load Balancer
- AWS Lambda
- Amazon SQS
- Amazon SNS
- AWS Secrets Manager
- Amazon CloudWatch
- AWS CloudTrail
- Route 53
- ACM
- CloudFront
- Terraform
- GitHub Actions
- AWS security and cost management

## Architecture Approach

The application is developed locally first.

Initial architecture:

```text
React
  |
  v
FastAPI
  |
  v
PostgreSQL

FastAPI
  |
  v
Local document storage
```

Local document storage is implemented behind a storage abstraction so it can later be replaced by Amazon S3.

The eventual AWS architecture will progressively introduce managed AWS services. AWS integration is intentionally deferred until the local application is complete and verified.

## Local Environment Configuration

The repository contains example environment files. Create local copies and customize them before starting the application:

| Local file | Example file | Purpose |
|---|---|---|
| `.env` | `.env.example` | Docker Compose and PostgreSQL credentials/host ports |
| `backend/.env` | `backend/.env.example` | FastAPI application, database, JWT, and local storage settings |
| `frontend/.env` | `frontend/.env.example` | Vite development API URL when running the frontend outside Docker |

Do not overwrite an existing local environment file. If one already exists, retain its values and add any newly required variables manually.

### Create the local files

From the repository root, on macOS/Linux/Git Bash:

```sh
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

The frontend environment file is optional for Docker Compose because the containerized frontend uses the Nginx same-origin API proxy. It is used when starting the Vite development server directly.

### Set local secrets

The example values `change_me` are placeholders, not secure credentials. Replace them in your local files before running the application:

- Set a unique, strong `POSTGRES_PASSWORD` in the root `.env`.
- Set a separate, long, randomly generated `JWT_SECRET_KEY` in `backend/.env`.
- Do not reuse database passwords as JWT signing secrets.
- Keep real credentials and local `.env` files out of Git.

Generate a random JWT secret with Python:

```sh
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Copy the generated value into `backend/.env` as the value of `JWT_SECRET_KEY`. Generate a separate password for PostgreSQL and store it only in the root `.env`.

### Database connection settings

The root `.env` supplies the PostgreSQL database name, username, password, and host port to Docker Compose. Within the Compose network, the backend connects to the database using hostname `postgres` and port `5432`; Compose supplies these internal connection values to the backend container.

When running the backend directly on the host, the example backend settings use `localhost:5433`, which is the default host port mapped to PostgreSQL by Compose.

### Frontend API URL

The Vite example uses:

```env
VITE_API_BASE_URL=http://localhost:8000
```

This is for a frontend development server running on the host. The Dockerized frontend is served by Nginx and proxies `/api/` requests to the backend container, so it does not need this host-side API URL.

## Run the application with Docker Compose

Docker Compose runs PostgreSQL, the FastAPI backend, and the built React frontend. The backend applies Alembic migrations when it starts. PostgreSQL data and uploaded documents are stored in named Docker volumes and persist when the containers stop.

1. Complete the local environment file setup described above.
2. Ensure Docker Desktop (or Docker Engine with the Compose plugin) is running.
3. Start the application from the repository root:

   ```sh
   docker compose up --build
   ```

4. Open the frontend at `http://localhost:8080`. The backend API and interactive documentation are available at `http://localhost:8000` and `http://localhost:8000/docs` by default.

The frontend proxies API and health requests to the backend, so browser requests use the same origin. The database is also available on `localhost:5433` by default. Set `FRONTEND_PORT`, `BACKEND_PORT`, and `POSTGRES_PORT` in the root `.env` to use different host ports.

Stop the containers with:

```sh
docker compose down
```

This keeps the database and uploaded documents in their named volumes for the next startup. To remove the containers and volumes, use `docker compose down --volumes`; this permanently deletes the local PostgreSQL data and uploaded documents.

## Core Features

- User registration
- User login
- User profile
- Folder management
- Document upload
- Document viewing
- Document search
- Document filtering
- Document download
- Document deletion
- Document versions
- Activity tracking
- Document processing status
- Optional document sharing

## Repository Structure

```text
.
├── backend/
├── frontend/
├── lambda/
├── infrastructure/
├── docs/
├── tests/
├── scripts/
├── .github/
├── .env.example
├── docker-compose.yml
└── README.md
```

## Security Notes

- Never commit `.env` files or real credentials.
- Keep `.env.example` files limited to placeholders and non-sensitive defaults.
- Do not commit AWS access keys, private keys, database dumps, or Terraform state.
- Use local configuration only for local development. Cloud secrets and permissions will be handled through appropriate AWS services during the later AWS implementation phase.

## Project Development Approach

Work is divided into two major stages:

1. **Local completion:** implement, test, and verify the application using the local stack.
2. **AWS implementation:** progressively introduce the planned AWS services after the local acceptance criteria have been met.

Do not create or depend on AWS resources during local completion.
