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