# Local DMS API Contract

**Contract status:** Describes the currently implemented local FastAPI routes. It is not a promise of unimplemented functionality. The interactive OpenAPI specification remains available at `/openapi.json` and Swagger UI at `/docs` while the backend is running.

## Base URL and authentication

The local API base URL is normally `http://localhost:8000`. Application routes use the `/api` prefix. Health routes are outside that prefix.

Protected routes require:

```http
Authorization: Bearer <access-token>
```

Registration and login are public. Logout requires an authenticated access token. The current access-token response is issued by `POST /api/auth/login`; refresh-token endpoints are not part of the current implementation.

## Common response conventions

- JSON request bodies use `Content-Type: application/json`.
- File uploads use `multipart/form-data`.
- Document downloads return a binary response with attachment headers.
- Successful delete operations return `204 No Content`.
- The backend adds an `X-Request-ID` response header to HTTP requests. The same ID appears in standardized JSON error responses.
- The API does not currently paginate the document or folder list endpoints. Activity history supports offset pagination.
- Unless specified otherwise, protected endpoints can return `401` for missing/invalid authentication and `403` for authorization denial.

## Standard error response

Application errors use the following response structure:

```json
{
  "detail": "Request validation failed",
  "request_id": "request-correlation-id",
  "errors": [
    {
      "location": "body.email",
      "message": "A valid email address is required",
      "type": "value_error"
    }
  ]
}
```

- `detail` is a safe, user-facing summary.
- `request_id` correlates the response with backend request logs.
- `errors` is present for request validation failures and contains field locations and messages. Submitted input values and validation context are not returned.
- HTTP error status codes and headers are preserved. In particular, authentication responses retain `WWW-Authenticate`.
- Database failures return `503` with a generic message. Unexpected server failures return `500` with a generic message.
- Internal exception messages, stack traces, SQL statements, and submitted credentials are not part of the API error body.

## Health and readiness

| Method | Path | Authentication | Success response |
|---|---|---|---|
| GET | `/health` | Public | `200 {"status":"healthy","service":"dms-backend"}` |
| GET | `/health/database` | Public | `200 {"status":"healthy","database":"dms"}` when PostgreSQL responds |
| GET | `/health/ready` | Public | `200 {"status":"ready","database":"healthy"}` when PostgreSQL responds |

The liveness endpoint does not query PostgreSQL. The database health and readiness endpoints execute `SELECT 1`; database errors are returned as standardized `503` responses.

## Authentication

| Method | Path | Authentication | Success |
|---|---|---|---|
| POST | `/api/auth/register` | Public | `201 UserResponse` |
| POST | `/api/auth/login` | Public | `200 AuthResponse` containing `access_token`, `token_type`, and user |
| POST | `/api/auth/logout` | Bearer token | `200 MessageResponse` |

Registration request fields: `email`, `password` (8–128 characters), and `display_name` (1–255 characters). Duplicate email returns `409`.

Login request fields: `email` and `password`. Invalid credentials return `401`; disabled accounts return `403`.

## User profile

| Method | Path | Authentication | Success |
|---|---|---|---|
| GET | `/api/users/me` | Bearer token | `200 UserProfileResponse` |
| PUT | `/api/users/me` | Bearer token | `200 UserProfileResponse` |

Profile update accepts `display_name` (1–255 characters).

## Folders

| Method | Path | Authentication | Success |
|---|---|---|---|
| POST | `/api/folders` | Bearer token | `201 FolderResponse` |
| GET | `/api/folders` | Bearer token | `200 FolderResponse[]` |
| GET | `/api/folders/{folder_id}` | Bearer token | `200 FolderResponse` |
| PUT | `/api/folders/{folder_id}` | Bearer token | `200 FolderResponse` |
| DELETE | `/api/folders/{folder_id}` | Bearer token | `204 No Content` |

Folder creation accepts `name` and optional `parent_folder_id`. Folder update accepts `name`. Folder listing is scoped to the authenticated user and sorted by name. A foreign or missing folder is rejected by the backend.

## Documents

| Method | Path | Authentication | Success |
|---|---|---|---|
| POST | `/api/documents/upload` | Bearer token | `201 DocumentResponse` |
| GET | `/api/documents` | Bearer token | `200 DocumentResponse[]` |
| GET | `/api/documents/{document_id}` | Bearer token | `200 DocumentResponse` |
| PATCH | `/api/documents/{document_id}` | Bearer token | `200 DocumentResponse` |
| PATCH | `/api/documents/{document_id}/move` | Bearer token | `200 DocumentResponse` |
| POST | `/api/documents/{document_id}/versions` | Bearer token | `201 DocumentResponse` |
| GET | `/api/documents/{document_id}/versions` | Bearer token | `200 DocumentVersionResponse[]` |
| DELETE | `/api/documents/{document_id}/versions/{version_number}` | Bearer token | `204 No Content` |
| GET | `/api/documents/{document_id}/download` | Bearer token | Binary attachment |
| GET | `/api/documents/{document_id}/versions/{version_number}/download` | Bearer token | Binary attachment |
| DELETE | `/api/documents/{document_id}` | Bearer token | `204 No Content` |

### Document list query parameters

- `search`: optional case-insensitive name search.
- `folder_id`: optional folder filter.
- `content_type`: optional content-type filter.
- `sort_by`: `created_at` (default) or `name`.
- `sort_order`: `desc` (default) or `asc`.

The document list returns an array, not a paginated envelope. No `limit` or `offset` parameter is currently implemented for this route.

### Uploads and versions

Initial upload uses multipart fields `file` and optional `folder_id`. Version upload uses multipart field `file`. Server-side file extension, size, and content checks are authoritative. A new version must use the document's existing file extension.

Document rename uses JSON `{"name":"new-name.pdf"}`. The extension cannot be changed. Move uses JSON `{"folder_id":"<uuid>"}`; explicit `null` moves the document to the user's root.

The current document version cannot be deleted independently. Deleting the document itself is a soft delete; its metadata and stored versions are retained under the existing project policy.

## Activity history

| Method | Path | Authentication | Success |
|---|---|---|---|
| GET | `/api/activities` | Bearer token | `200 ActivityResponse[]` |

Query parameters:

- `document_id`: optional UUID filter.
- `limit`: default `50`, minimum `1`, maximum `100`.
- `offset`: default `0`, minimum `0`.

Results are scoped to the authenticated user and ordered newest first.

## Status code summary

| Status | Meaning in this API |
|---|---|
| 200 | Successful read, update, login, or logout |
| 201 | Resource created or file uploaded |
| 204 | Successful delete with no response body |
| 400 | Invalid operation or file/document naming constraint |
| 401 | Missing or invalid authentication / invalid login credentials |
| 403 | Authenticated user lacks permission or account is disabled |
| 404 | Resource or stored file not found |
| 409 | Duplicate account, current-version deletion conflict, or document state conflict |
| 422 | Request validation failure; includes sanitized field issues |
| 500 | Unexpected application error; generic message only |
| 503 | Database operation unavailable or failed |

Individual routes may have additional operation-specific errors. Consult the generated OpenAPI schema for the live response definitions.
