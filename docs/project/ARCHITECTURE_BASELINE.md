# AWS Document Management System — Architecture Baseline

**Document purpose:** Preserve the approved project scope, functional requirements, architecture principles, and target **AWS** learning architecture.

**Source of truth:** Original **AWS** Document Management System project report supplied by the project owner.

**Current implementation stage:** Local development and verification.

****AWS** integration:** Planned; not part of the current local completion stage.

---

## 1. Project Overview

The **AWS** Document Management System (**DMS**) is an independent, learning-focused web application.

Its primary purpose is to provide hands-on experience with software engineering and commonly used **AWS** services through a practical document management application.

The application is intentionally kept small and understandable. The project is not intended to become a large enterprise document management platform.

The project is independent of the CommerceX project.

## 2. Project Goals

### Primary goals

- Learn commonly used **AWS** services through a practical application.
- Understand **AWS** infrastructure and networking.
- Practice container-based deployment using **ECS** and Fargate.
- Practice managed PostgreSQL using **RDS**.
- Learn private object storage using S3.
- Learn asynchronous processing using **SQS**.
- Learn serverless processing using Lambda.
- Learn notification publishing using **SNS**.
- Learn application monitoring using CloudWatch.
- Learn account auditing using CloudTrail.
- Learn **DNS** and **HTTPS** using Route 53 and **ACM**.
- Learn frontend **CDN** delivery using CloudFront.
- Learn infrastructure automation using Terraform.
- Learn CI/CD using GitHub Actions.
- Learn **AWS** cost management and resource cleanup.

### Secondary goals

- Improve Python and FastAPI skills.
- Improve Docker skills.
- Practice **REST** **API** design.
- Practice relational database design.
- Practice authentication and authorization.
- Practice asynchronous architecture.
- Practice failure handling and observability.
- Build a portfolio project demonstrating cloud engineering fundamentals.

## 3. Non-Goals

The baseline project does not require:

- Microservices architecture.
- Complex workflow engines.
- Payment functionality.
- E-commerce functionality.
- Enterprise document approval workflows.
- Advanced **OCR**.
- Full-text search engines.
- Multi-region deployment.
- Multi-account **AWS** architecture.
- Production-grade multi-region high availability.
- Kubernetes/**EKS**.
- Amazon **MSK**.
- Machine learning features.

Optional advanced **AWS** services may be explored later as separate learning labs.

## 4. Technology Stack

### Frontend

- React
- Vite
- React Router
- Axios
- Component-based UI
- Optional Tailwind **CSS** or plain **CSS**

### Backend

- Python
- FastAPI
- Uvicorn
- Pydantic
- SQLAlchemy
- Alembic
- PyJWT or an equivalent **JWT** implementation
- A secure password-hashing implementation
- boto3 for **AWS** integration

### Database

- PostgreSQL

### Local infrastructure

- Docker
- Docker Compose

### Cloud and engineering tools

- **AWS**
- Terraform
- GitHub Actions
- Git and GitHub
- **AWS** **CLI**

The precise package versions and implementations must be taken from the repository and verified during the relevant tasks.

## 5. Functional Requirements

### 5.1 Authentication

- User registration.
- User login.
- **JWT** access token.
- Logout.
- Authenticated **API** access.
- Rejection of unauthorized requests.
- Secure password hashing.
- User identity extraction from the **JWT**.

### 5.2 User profile

- View profile.
- Update profile.
- Optional profile picture.
- Account creation timestamp.

### 5.3 Folder management

- Create folder.
- Rename folder.
- Delete folder.
- List folders.
- Nested folders are optional.

### 5.4 Document management

- Upload documents.
- View document metadata.
- List documents.
- Search documents.
- Filter by folder.
- Filter by file type.
- Sort by date and name.
- Download documents.
- Delete documents.
- Move documents between folders.
- View processing state.

### 5.5 Document versioning

- Upload a new version.
- Track version numbers.
- View version history.
- Download a selected version.
- Remove old versions.

### 5.6 Document processing

- Validate file type.
- Validate file size.
- Record upload status.
- Trigger asynchronous processing.
- Update processing state.
- Record processing failure.

### 5.7 Activity history

Record significant actions such as:

- Upload.
- Download.
- Delete.
- Rename.
- Move.
- Version creation.
- Share and revoke share.

### 5.8 Administration

Optional initial administration functionality:

- List users.
- Enable or disable a user.
- View basic account information.

### 5.9 Document sharing

Document sharing is optional in the original project scope. If implemented, access must be checked by the backend and must respect the granted permission and any expiry.

## 6. Non-Functional Requirements

### Security

- **HTTPS** for public endpoints.
- Private S3 document bucket.
- No hard-coded credentials.
- Cloud secrets stored in Secrets Manager.
- **IAM** least privilege.
- Private database.
- Restricted security groups.
- **JWT** validation.
- Server-side document ownership checks.
- Input validation.
- File size limits.
- File type allowlist.

### Availability and reliability

- **ECS** service should recover failed containers.
- **ALB** health checks should identify unhealthy application tasks.
- Background processing should tolerate transient failures.
- **SQS** should support retry and dead-letter behavior.

### Maintainability

- Modular FastAPI application.
- Clear configuration separation.
- Environment-specific configuration.
- Automated tests.
- Dockerized backend.
- Terraform-managed **AWS** infrastructure.

### Observability

- Centralized application logs.
- **AWS** service metrics.
- Error monitoring.
- Basic dashboards.
- Operational alarms.

### Cost control

- Use one **AWS** Region for the project.
- Use small practical resource sizes.
- Run expensive resources only while performing labs.
- Delete resources when continuous availability is unnecessary.
- Keep a substantial portion of the **AWS** learning credit as a reserve.
- Monitor billing and usage frequently.
- Perform a full cleanup before credits are exhausted.

## 7. High-Level Local Architecture

The local application is intended to follow this structure:

```text
    Browser
    |
    v
    React + Vite
    |
    v
    FastAPI **API**
    /     \
    v       v
    PostgreSQL   Local File Storage
    Metadata     Document Binaries
```

The local version intentionally uses a simple infrastructure setup.

Docker Compose may run:

- Frontend.
- Backend.
- PostgreSQL.

Document files are stored through the local storage implementation.

The local implementation must not require **AWS** credentials or **AWS** resources.

## 8. Target AWS Architecture

The eventual target architecture described in the original report is:

```text
    **INTERNET**
    |
    Route 53
    |
    +------------+------------+
    |                         |
    v                         v
    CloudFront                   **ALB**
    |                         |
    v                         v
    S3 Frontend              **ECS** / Fargate
    |
    FastAPI **API**
    |
    +-----------------------------+--------------------+
    |                             |                    |
    v                             v                    v
    **RDS** PostgreSQL                 S3 Documents          **SQS** Queue
    |                                                  |
    |                                                  v
    |                                                Lambda
    |                                                  |
    |                                                  v
    |                                                 SNS
    |
    Document Metadata
    Supporting services:
    **IAM**, **VPC**, **ECR**, Secrets Manager, CloudWatch,
    CloudTrail, **ACM**, **AWS** Budgets

    Engineering:
    Terraform, GitHub Actions, **AWS** **CLI**
```

This is the target design, not a statement that the services have already been deployed.

## 9. Architecture Principles

### 9.1 Relational data and document binaries

PostgreSQL stores:

- Users.
- Folders.
- Document metadata.
- Object keys.
- File size.
- File type.
- Processing status.
- Version information.
- Activity records.
- Optional sharing information.

Object storage stores:

- **PDF** files.
- Images.
- Office documents.
- Text documents.
- Document versions.
- Optional derived files.

Document binaries should not be stored directly in PostgreSQL.

### 9.2 Backend responsibilities

FastAPI is responsible for:

- Authentication.
- Authorization.
- Metadata operations.
- Ownership checks.
- Temporary/pre-signed **URL** generation in the **AWS** implementation.
- Database operations.
- Document status management.
- Initiating asynchronous work.

### 9.3 AWS service responsibilities

| Service | Intended responsibility |
|---|---|
| S3 | Document object storage |
| RDS PostgreSQL | Relational metadata |
| SQS | Buffer asynchronous processing jobs |
| Lambda | Short-lived background processing |
| SNS | Publish notifications |
| ECS/Fargate | Run FastAPI containers |
| ALB | Route API traffic |
| CloudFront | Deliver frontend assets |
| Route 53 | DNS |
| Secrets Manager | Store application secrets |
| CloudWatch | Logs, metrics, dashboards, alarms |
| CloudTrail | Audit AWS account/API activity |
| IAM | AWS permissions |
| VPC | Network isolation and routing |
| ECR | Container image registry |
| ACM | TLS certificates |
| AWS Budgets | Cost alerts and budget management |

## 10. Data Model Baseline

The original report proposes the following logical entities.

### User

- `id`
- `email`
- `password_hash`
- `display_name`
- `role`
- `is_active`
- `created_at`
- `updated_at`

### Folder

- `id`
- `user_id`
- `parent_folder_id`
- `name`
- `created_at`
- `updated_at`

### Document

- `id`
- `user_id`
- `folder_id`
- `name`
- `content_type`
- `size_bytes`
- `current_version`
- `s3_key`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

The `s3_key` name represents the target **AWS** storage model. The local implementation may use a storage-specific identifier or path, provided the storage boundary remains clear.

### DocumentVersion

- `id`
- `document_id`
- `version_number`
- `s3_key`
- `size_bytes`
- `checksum`
- `created_at`

### Activity

- `id`
- `user_id`
- `document_id`
- `action`
- `metadata_json`
- `created_at`

### DocumentShare (optional)

- `id`
- `document_id`
- `owner_id`
- `shared_with_user_id`
- `permission`
- `created_at`
- `expires_at`

## 11. Database Rules

- A user owns their folders and documents.
- A document belongs to one user.
- A folder belongs to one user.
- `parent_folder_id` may be null for a root folder.
- `current_version` identifies the active document version.
- The storage key identifies the current stored object.
- Document binaries are not stored in PostgreSQL.
- Database constraints should prevent invalid ownership relationships.
- Deletion must account for the possibility that stored files remain after metadata deletion.

## 12. Document Upload Flow

The **AWS** target upload flow is:

```text
Browser
    |
    | Request upload URL
    v
FastAPI
    |
    | Authenticate user
    | Validate metadata
    | Generate pre-signed URL
    v
Browser
    |
    | Upload file
    v
Private S3
    |
    | Trigger or notify processing
    v
**SQS**
    |
    v
Lambda
    |
    | Validate/process
    | Update processing state
    v
**RDS**
```

The local implementation should provide equivalent application behavior using local storage and the local backend.

Suggested document states from the original report:

- `PENDING_UPLOAD`
- `**UPLOADED**`
- `**PROCESSING**`
- `**READY**`
- `**FAILED**`
- `**DELETED**`

The actual repository implementation must be inspected before deciding whether changes to its status model are necessary.

## 13. Document Download Flow

The backend must:

## Authenticate the requesting user.

## Check document ownership or explicitly granted access. ## Resolve the correct stored object. ## Return the file through the appropriate local or cloud storage mechanism.

A document must never be downloadable solely because a user knows a storage path or S3 object key.

## 14. Asynchronous Processing

The target **AWS** processing flow is:

```text
S3 Upload
    |
    v
**SQS**
    |
    v
Lambda
    |
    +--> Validate file metadata
    |
    +--> Optional thumbnail generation
    |
    +--> Calculate checksum/metadata
    |
    +--> Update **RDS** processing state
    |
    +--> Publish **SNS** notification
```

The design should account for:

- Retry behavior.
- Idempotency.
- Dead-letter handling.
- Error logging.
- Failure visibility.

This is an **AWS** target capability and must not be treated as locally implemented unless a corresponding local implementation exists and is verified.

## 15. Security Baseline

### User and application security

- Passwords are hashed using the existing `pwdlib` recommended password-hashing configuration (Argon2).
- Never log passwords.
- Issue expiring JWT access tokens using the configured HS256 algorithm.
- Include and validate the required JWT identity, role, issued-at, expiration, and token-version claims.
- Compare the token's `ver` claim with the authenticated user's persisted `token_version`.
- Increment `token_version` on logout so previously issued access tokens for that account are rejected.
- Require authentication for protected endpoints and reject missing, malformed, expired, incorrectly signed, or revoked tokens.
- Keep role authorization and resource ownership checks as separate server-side controls.
- Registration assigns the standard user role server-side; clients cannot grant themselves administrative roles.
- Normalize email addresses for registration and handle duplicate registration conflicts.
- Validate request data, including non-empty display names.
- Validate configuration at application startup, including JWT secret strength, allowed signing algorithm, token lifetime, upload size, and CORS origins.
- Configure CORS through an explicit origin allowlist. Production deployments must supply trusted frontend origins; do not use wildcard origins with credentialed requests.
- Restrict file size and allowed file types.

### S3 security

- Block public access.
- Keep document objects private.
- Use **IAM** and pre-signed URLs.
- Enable encryption.
- Consider versioning.
- Apply lifecycle policies where useful.

### Network security

- **RDS** should be private.
- **ECS** should run in private subnets in the target architecture.
- **ALB** should be public where required.
- Restrict security group communication.
- Allow database connections only from the application security group.
- Do not expose PostgreSQL to `0.0.0.0/0`.

### Secret security

The local implementation uses environment-based configuration and safe example values. Production secret values must be supplied through the deployment environment or an appropriate secret-management service.

Never commit:

- Database passwords.
- **JWT** secrets.
- **AWS** access keys.
- **AWS** secret keys.
- Private keys.
- Other credentials.

Use Secrets Manager for cloud runtime secrets.

### IAM security

Prefer service roles:

- **ECS** task role.
- **ECS** task execution role.
- Lambda execution role.

Avoid permanent credentials in application code or containers.

## 16. API Baseline

The original report proposes these endpoint groups.

### Authentication and user profile

```text **POST**   /api/auth/register **POST**   /api/auth/login **POST**   /api/auth/logout **GET**    /api/users/me ```

### Folders

```text **GET**    /api/folders **POST**   /api/folders **PATCH**  /api/folders/{folder_id} **DELETE** /api/folders/{folder_id} ```

### Documents

```text **GET**    /api/documents **GET**    /api/documents/{document_id} **POST**   /api/documents/upload-url **POST**   /api/documents/{document_id}/complete **GET**    /api/documents/{document_id}/download-url **DELETE** /api/documents/{document_id} **PATCH**  /api/documents/{document_id}/move ```

### Versions

```text **GET**    /api/documents/{document_id}/versions **POST**   /api/documents/{document_id}/versions/upload-url **GET**    /api/documents/{document_id}/versions/{version_id}/download-url ```

### Administration

```text **GET**    /api/admin/users **PATCH**  /api/admin/users/{user_id}/status ```

These are design references from the original report. The actual **API** contract must be taken from the implemented application and reviewed separately. Do not change routes solely to make the implementation match this list without examining existing behavior and obtaining approval.

## 17. Target Repository Organization

The original report suggests a repository organization containing:

```text aws-document-management-system/ ├── backend/ ├── frontend/ ├── lambda/ ├── infrastructure/ │   └── terraform/ ├── docs/ │   ├── architecture/ │   ├── api/ │   ├── aws/ │   └── troubleshooting/ ├── tests/ ├── scripts/ ├── .github/ │   └── workflows/ ├── .gitignore ├── **README**.md └── docker-compose.yml ```

The current repository may contain additional or different files. Existing structure should be preserved unless a change is justified and approved.

## 18. AWS Learning Roadmap

The original report describes these learning stages:

## AWS account safety.

## AWS CLI and IAM.
## VPC networking.
4. **EC2**.
5. **RDS**.
6. S3.
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
## Final deployment, operational verification, and cost-safe cleanup.

**AWS** implementation begins only after the local acceptance gate is passed and the project owner approves the transition.

## 19. Cost and Cleanup Requirements

The project uses a limited **AWS** learning budget.

Every **AWS** stage must document:

- Resources created.
- Region.
- Pricing considerations.
- Configuration.
- Verification.
- Cleanup procedure.
- Resources that may continue generating charges.
- Any retained resources and their reason.

Do not assume stopping an **AWS** resource eliminates all costs. Storage, snapshots, IP addresses, logs, networking, and other retained resources may continue to incur charges.

A cleanup checklist must be followed after each lab where continuous availability is not needed.

## 20. Architecture Change Control

The original project report is the baseline.

If a requirement appears unsuitable or needs changing:

## Identify the original requirement.

## Explain the issue. ## Present alternatives. ## Explain consequences. ## Obtain the project owner's agreement. ## Record the agreed decision in `docs/project/DECISIONS.md`. ## Update this baseline only when the agreed decision changes the architecture or requirements.

Do not silently replace the original architecture or scope.
