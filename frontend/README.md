# DMS Frontend

React 19 and Vite frontend for the local-first AWS Document Management System.

## Responsibilities

The frontend provides the user interface for:

- Registration, login, logout, and protected navigation.
- User profile viewing and display-name updates.
- Folder creation, navigation, rename, and deletion.
- Document upload, listing, search, filtering, sorting, download, and soft deletion.
- Document details, rename, movement between folders, and version history.
- Uploading/downloading versions and deleting non-current historical versions.
- Activity history and dashboard summaries.

The FastAPI backend remains authoritative for authentication, authorization, ownership, file validation, and data integrity. Hiding a control in the frontend is not an access-control mechanism.

## Requirements

- Node.js compatible with the Vite version in `package.json`.
- npm.
- The FastAPI backend running locally, unless using the full Docker Compose setup from the repository root.

## Environment

For running Vite directly, create `frontend/.env` from `frontend/.env.example` and configure:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Do not commit local environment files or credentials.

When using Docker Compose, the frontend is served by Nginx and uses the same-origin `/api/` proxy. The host-side Vite API URL is not required for that setup.

## Install and run

From this directory:

```bash
npm ci
npm run dev
```

The Vite development server prints its local URL in the terminal.

## Quality checks

```bash
npm test
npm run lint
npm run build
```

- `npm test` runs the Vitest suite once.
- `npm run lint` runs ESLint.
- `npm run build` creates the production frontend bundle.

The project owner has deferred the broader test execution until the dedicated testing phase. Do not treat the presence of test files as evidence that they pass.

## Authentication and frontend security notes

- The API client attaches the stored bearer access token to requests.
- A 401 response from a protected endpoint clears the stored token and signals the authentication context to clear the in-memory user session. Login and registration 401 responses are not treated as an expired authenticated session.
- The current implementation stores the access token in browser localStorage. JavaScript running in the page can read localStorage; this is not equivalent to an HttpOnly cookie. Preventing cross-site scripting remains important. The project has not changed its backend authentication contract to cookie-based authentication.
- Client-side file extension and size checks provide early feedback only. FastAPI performs the authoritative validation.
- Document and folder ownership is enforced by the backend. Frontend route guards and hidden controls do not replace backend authorization.
- Document binaries are downloaded through authenticated API endpoints rather than by exposing local storage paths.

## Local deployment

For the complete local environment, including PostgreSQL, FastAPI, and the Nginx-served frontend, follow the root [README](../README.md) and start Docker Compose from the repository root.
