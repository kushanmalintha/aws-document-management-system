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

React
    ↓
FastAPI
    ↓
PostgreSQL

Local document storage is implemented behind a storage abstraction so it can later be replaced by Amazon S3.

The eventual AWS architecture will progressively introduce managed AWS services.

## Run the application with Docker Compose

Docker Compose runs PostgreSQL, the FastAPI backend, and the built React frontend.
The backend applies Alembic migrations when it starts. PostgreSQL data and uploaded
documents are stored in named Docker volumes and persist when the containers stop.

1. Create `.env` from `.env.example` if you do not already have a root `.env` file.
   If one already exists, add any missing Compose variables to it without replacing
   your existing settings. Set a local database password and a long random JWT
   secret before starting the services.
2. Start the application from the repository root:

   ```sh
   docker compose up --build
   ```

3. Open the frontend at `http://localhost:8080`. The backend API and interactive
   documentation are available at `http://localhost:8000` and
   `http://localhost:8000/docs`.

The frontend proxies API and health requests to the backend, so browser requests
use the same origin. The database is also available on `localhost:5433` by default.
Set `FRONTEND_PORT`, `BACKEND_PORT`, and `POSTGRES_PORT` in `.env` to use different
host ports.

Stop the containers with `docker compose down`. This keeps the database and uploaded
documents in their named volumes for the next startup.

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
backend/
frontend/
lambda/
infrastructure/
docs/
tests/
scripts/
.github/
