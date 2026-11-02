# JanaSeva (ଜନସେବା)

JanaSeva is a bilingual (English/Odia) application workflow dashboard for fictional income-certificate applications. The frontend is a React, TypeScript and Vite application. The Express/TypeScript API supports persistent local JSON file storage for development and keeps MongoDB as an optional storage adapter.

The sample records and accounts are demonstration data only. This project does not claim integration with, approval by, or compliance with any government service or official document process.

## Requirements

- Node.js 20.19+ (or 22.12+) and npm

## Configuration

Copy `backend/.env.example` to `backend/.env` and set values:

```env
PORT=5000
STORAGE_MODE=json
JSON_STORAGE_DIR=
DOCUMENT_STORAGE_DIR=
DOCUMENT_MAX_SIZE_BYTES=5242880
MONGODB_URI=mongodb://127.0.0.1:27017/janaseva
JWT_SECRET=replace-with-at-least-32-random-characters
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
JWT_EXPIRES_IN=8h
OPENAI_API_KEY=
AI_MODEL=gpt-4.1-mini
```

Set `STORAGE_MODE=json` to use local files; MongoDB does not need to be installed or reachable in this mode. `JWT_SECRET` must be a private value of at least 32 characters. Optionally set `JSON_STORAGE_DIR` to a directory for the data file; by default it is `backend/data`. Do not put secrets or real citizen data in source control. `.env` files and the live JSON store are ignored by Git.

Uploads are stored privately under `backend/uploads` by default, separate from the public frontend. Set `DOCUMENT_STORAGE_DIR` to change this directory and `DOCUMENT_MAX_SIZE_BYTES` to change the per-file limit (default `5242880`, or 5 MiB; maximum 25 MiB). The JSON store contains only document metadata and a generated storage key, never file contents. Both the upload directory and live application data are excluded from Git.

To use MongoDB instead, set `STORAGE_MODE=mongodb`, configure `MONGODB_URI` with a local MongoDB or Atlas URI, then use the existing Mongoose adapter. For **MongoDB Atlas**, create a database user, add the development machine to the cluster network access list, and URL-encode special characters in credentials.

AI assistance is optional. Set `OPENAI_API_KEY` in the private `backend/.env` file to enable it; leave it unset to run the rest of the application without AI. `AI_MODEL` selects the OpenAI model and defaults to `gpt-4.1-mini`. Never add the API key to frontend environment variables or source control. The AI routes return an explicit configuration error when no key is set.

The frontend optionally reads `VITE_API_URL` from a root `.env` file. Its default is `http://localhost:5000/api`, matching the backend port above.

## Run locally

In the repository root, install frontend dependencies and start Vite:

```sh
npm install
npm run dev
```

In another terminal, install backend dependencies, configure `backend/.env` with `STORAGE_MODE=json` and a private JWT secret, validate local storage, and start the API:

```sh
npm install --prefix backend
npm run db:check --prefix backend
npm run dev --prefix backend
```

The API listens on the configured `PORT` (5000 by default); `GET /api/health` reports the active storage mode and readiness. On first startup, JSON mode validates the tracked fictional seed files and creates `backend/data/store.json`. It does not overwrite an existing store. Applications, user records, bcrypt password hashes and audit logs are kept together in that JSON file so a state update can be written atomically. Use a single backend process for this local-file development store; write locks serialize concurrent requests/processes, and a temporary file plus atomic rename protects the stored state from partial writes. The frontend does not substitute sample records when requests fail.

To check persistence, sign in and update an application's workflow or document verification, stop the API with Ctrl+C, start it again with `npm run dev --prefix backend`, sign in again, and revisit the application and its history. The status/document update and audit entry should still be present. `npm run db:check --prefix backend` can be rerun at any time; in JSON mode it checks the file and schema instead of contacting a database.

### Fictional seed accounts

The initial JSON seed creates these fictional accounts on first run; the password values are bcrypt hashes, not plaintext:

| Role | Email | Demo password |
|---|---|---|
| Administrator | `admin@janaseva.local` | `JanaSevaDemo#2026` |
| Revenue Officer | `revenue@janaseva.local` | `JanaSevaDemo#2026` |
| Field Officer | `field@janaseva.local` | `JanaSevaDemo#2026` |

These are public demo credentials, not production credentials. Never use these accounts in a real deployment. For MongoDB mode only, `npm run seed --prefix backend` creates/refreshes the same demo accounts and applications.

## Backend layout

```text
backend/
  src/
    config/       Environment validation and MongoDB connection
    controllers/  HTTP request handlers
    middleware/   JWT authentication, role checks, validation and errors
    models/       Mongoose User, Application and AuditLog schemas
    routes/       Authentication, user, application and AI routes
    services/     Application, audit, auth, workflow and AI operations
    storage/      Safe JSON adapter, private local document storage and tests
    validators/   Zod input schemas
    utils/        HTTP errors and async route wrapper
    app.ts
    server.ts
    seed.ts
    checkDatabase.ts
  data/
    seed-users.json
    seed-applications.json
    seed-audit-logs.json
  uploads/            Private local document files (created at runtime, ignored by Git)
```

`backend/data/store.json` is created at runtime and ignored by Git. Back it up before removing or replacing it; seed files only initialize a missing store.

## Roles and workflow

- **ADMIN** can view all districts, manage users and system configuration, create applications, review documents, and make final decisions.
- **REVENUE_OFFICER** is scoped to the officer's district, can create and process applications, assign officers in-district, review documents, return applications for correction, and make final decisions.
- **FIELD_OFFICER** is scoped to assigned applications and can submit field observations and complete assigned field verification. Field officers cannot verify documents, return applications, or make final decisions.

Supported workflow states are Application received, Document verification, Field verification, Final decision, Returned for correction, Approved and Rejected. The server validates role permissions, allowed transitions, required configured document checks and field observations independently of the frontend. Only an administrator or revenue officer may approve, reject, or return an application. Every final decision needs written remarks; rejection reasons and return instructions are retained in application history. A final decision is accepted once, and terminal applications cannot receive another decision.

### Final decision workflow

1. A revenue officer reviews the configured document records and completes document verification only after every applicable, required document has an uploaded file and is verified.
2. The assigned field officer records field observations and completes field verification. The workflow cannot proceed to final review without saved observations.
3. An administrator or revenue officer reviews applicant details, document results, field observations, outstanding items, officer remarks and the read-only application history on the **Final Review** page. Incomplete verification is displayed and blocks approval or rejection.
4. The officer records non-empty decision remarks and confirms **Approve** or **Reject**, or supplies correction instructions and confirms **Return for Correction**. Returned applications retain their earlier verification records; an authorized resubmission returns them to document verification and appends a history entry.

The role checks apply to both the interface and backend APIs; hiding a button is not the security boundary. Document-review and final-decision APIs deny field officers. Field observation updates are limited to the assigned field officer during the field-verification stage. Status changes cannot be submitted through the ordinary application-edit API.

Each audit-history entry records its application, officer ID and role, action, previous and new status, remarks/reason, and timestamp. The history endpoint is read-only; ordinary application APIs do not expose audit-log editing. JSON storage persists decision and audit records atomically. MongoDB uses conditional updates to prevent duplicate final decisions, recheck required evidence at decision time, and prevent a document deletion from racing a terminal decision.

The printable JanaSeva decision summary shows the application, applicant, decision, date, officer and remarks. It is explicitly an administrative record, not an income certificate or a government-issued certificate. AI application summaries are optional, appear separately from officer decisions, and cannot approve, reject, or establish eligibility. Officers must review the source evidence and remain responsible for every decision; AI output and confidence are not proof.

Required-document flags remain configurable per application. The workflow does not add income thresholds, document categories or other official eligibility requirements.

Document categories include identity proof, address proof, income proof, ration card, supporting documents and other documents. Legacy demo categories remain accepted. Category, applicability and required status are stored per application and remain configurable; an upload does not make a document mandatory. Sample values are illustrative only and do not establish official requirements.

Uploaded files are written through a document-storage abstraction to generated UUID-based filenames in the private backend upload directory. Original names, detected MIME type, size and upload timestamp are persisted in the existing JSON store (or MongoDB adapter); file bytes are never written to JSON. Downloads are authenticated, scoped to the user's application access, streamed from storage and audited. Uploads are limited to PDF, JPG/JPEG and PNG, checked against extension, declared MIME type and file signature, and limited to 5 MiB per file by default.

The tracked demo seed includes placeholder document metadata from the earlier workflow phase; those placeholders are not actual stored files. Replace them with uploaded files before previewing or downloading them.

## API

All `/api/applications` and `/api/users` routes require `Authorization: Bearer <JWT>`. Login tokens are returned only after bcrypt password verification. Password hashes are excluded from user queries and API responses. List results are district/assignment scoped by role.

### Authentication

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Validate credentials; return token and public user |
| GET | `/api/auth/me` | Return the authenticated public user |

Login body: `{ "email": "revenue@janaseva.local", "password": "…" }`.

### Applications

| Method | Path | Description |
|---|---|---|
| GET | `/api/applications` | Paginated list; supports `page`, `pageSize`, `search`, `district`, `status`, `priority`, `submittedFrom`, `submittedTo` |
| GET | `/api/applications/summary` | Role-scoped dashboard totals, alerts and recent audit activity |
| POST | `/api/applications` | Create an application (ADMIN/REVENUE_OFFICER) |
| GET | `/api/applications/:applicationId` | Application details |
| PATCH | `/api/applications/:applicationId` | Update priority or verification remarks (ADMIN/REVENUE_OFFICER) |
| PATCH | `/api/applications/:applicationId/status` | Apply a validated workflow action |
| PATCH | `/api/applications/:applicationId/field-observations` | Save assigned field-officer observations during field verification |
| PATCH | `/api/applications/:applicationId/assign` | Assign an in-district officer (ADMIN/REVENUE_OFFICER) |
| GET | `/api/applications/:applicationId/documents` | List documents |
| POST | `/api/applications/:applicationId/documents` | Upload or replace a document file (`multipart/form-data`, ADMIN/REVENUE_OFFICER) |
| PATCH | `/api/applications/:applicationId/documents/:documentId` | Update verification state/remarks (ADMIN/REVENUE_OFFICER) |
| GET | `/api/applications/:applicationId/history` | Read chronological audit events |
| GET | `/api/documents/:documentId` | Read document metadata (application-access scoped) |
| GET | `/api/documents/:documentId/download` | Securely stream a document download; `?disposition=inline` is used for preview |
| DELETE | `/api/documents/:documentId` | Remove the uploaded file and retain the configured document record |

For multipart upload, include `file` and either `documentId` to attach/replace a configured row or `documentType` to create a row. New rows accept optional `applicable=true|false` and `required=true|false`; omitted values default to applicable and optional. Accepted categories are `identity`, `address`, `income`, `ration`, `supporting` and `other`. Allowed file extensions and matching MIME types are `.pdf` / `application/pdf`, `.jpg` or `.jpeg` / `image/jpeg`, and `.png` / `image/png`. Uploads are limited to 5 MiB by default; change `DOCUMENT_MAX_SIZE_BYTES` to configure the limit. The server generates storage filenames and sanitizes the original name before storing it as metadata.

All document endpoints require a bearer token. Revenue officers can access records in their district; field officers can access only assigned applications; administrators can access all applications. Unavailable or inaccessible documents do not reveal filesystem paths.

Status actions: `start_verification`, `complete_document_verification`, `request_missing_documents`, `return_for_correction`, `resubmit`, `start_field_verification`, `complete_field_verification`, `approve`, `reject`. Document and decision/return actions are restricted to ADMIN/REVENUE_OFFICER; field verification and observation submission are restricted to the assigned FIELD_OFFICER. Provide remarks for decisions, returns, field verification and missing-document requests. Completing document verification requires each applicable, required document to have a file and be verified; completing field verification requires saved observations. Final decisions also recheck both verification requirements.

The `GET /api/applications/:applicationId/history` endpoint returns audit entries for display and cannot be used to edit them. A decision action is recorded with its officer role, prior/new status, reason and timestamp.

### Users

| Method | Path | Description |
|---|---|---|
| GET | `/api/users/officers` | List active in-district Revenue and Field Officers for assignment (ADMIN/REVENUE_OFFICER) |
| GET | `/api/users` | List users; optional `district`, `role` and `active` filters (ADMIN) |
| POST | `/api/users` | Create an account with a bcrypt-hashed initial password (ADMIN) |
| PATCH | `/api/users/:userId` | Update name, role, district or active state; the last active administrator cannot be removed (ADMIN) |

User creation body: `{ "name": "Officer Name", "email": "officer@example.local", "password": "use-a-unique-long-password", "role": "FIELD_OFFICER", "district": "Khordha" }`. User responses never include password hashes.

Validation errors return `400`; authentication errors `401`; role/scope violations `403`; unavailable/invalid workflow transitions `409`; unexpected server errors return a generic `500` message. Requests are JSON-limited and CORS is restricted to `FRONTEND_URL`.

### AI assistant

| Method | Path | Description |
|---|---|---|
| POST | `/api/ai/document-review` | Review document metadata and application fields for possible gaps or inconsistencies |
| POST | `/api/ai/field-checklist` | Generate a field visit checklist without asserting that a visit occurred |
| POST | `/api/ai/field-summary` | Summarize only the field observations submitted by the officer and persist those observations |
| POST | `/api/ai/application-summary` | Generate a neutral summary of the application record |

AI document review, field checklist and application summary endpoints require an authenticated administrator, revenue officer or field officer; application access remains scoped to the user's permissions. Submitting field observations for an AI field summary is limited to field officers. Requests use `{ "applicationId": "INC-2026-0012", "language": "en" }` (or `"or"` for Odia). The field summary additionally requires officer-entered `observations`. AI requests are rate limited. Provider/configuration failures return explicit errors; there is no fallback to fictional or fabricated AI output.

AI receives only the data needed for each task. Document review uses the uploaded-file metadata, document types, applicability/required flags, verification states and sanitized remarks; file contents and full identification/mobile numbers are not sent. Uploaded document contents are therefore not treated as instructions or used for extraction, and AI cannot authenticate official documents. Field summary uses only supplied officer-entered observations, after redacting common phone, email and identification-number patterns. AI output is displayed as suggestions and uncertainty, not as verified facts. AI cannot approve, reject, assign, or change workflow status. An authorized human officer remains responsible for every action and decision. AI assistance actions are recorded in application history without storing prompts or generated responses.

Limitations: document file contents are not provided to the model, so AI cannot authenticate documents or extract facts from uploaded files. Redaction is pattern-based and cannot guarantee removal of all personal information. Review generated content for accuracy and bias; do not rely on it as an eligibility determination or substitute for official process.

## Checks

```sh
npm run build
npm run lint
npm run build
npm run test
npm run test:e2e
npm run db:check --prefix backend
```

Backend tests cover workflow transition guards, authenticated API workflows for approval/correction/rejection, RBAC, application and user operations, document upload/download/deletion, audit history and restart persistence, JSON initialization/concurrent writes, and mock-based AI behavior. `db:check` validates the currently selected adapter; JSON mode needs no database server.

The API integration tests use a temporary JSON store and fictional records; they do not modify the live development store. `npm run test:e2e` builds the backend and runs four Playwright browser scenarios against isolated servers and temporary JSON/document storage. The test suite creates fictional applications and officer accounts, verifies browser workflows, and removes its data directory at teardown. The ports 5508 and 5175 must be available.

## Current limitations

- JSON storage is intended for local development and a single application instance, not multi-host production deployment. MongoDB remains available as an optional adapter.
- Local document storage is intended for development. It validates extension/MIME/signature but does not include antivirus scanning, content disarm/reconstruction, or official-document authentication; use a private, backed-up storage service and appropriate malware scanning before production. MongoDB metadata mode currently uses the same local file-storage adapter; a cloud object-storage adapter can replace it.
- **Team management** is available to administrators for listing, searching/filtering, creating, editing, role/district assignment, and activation/deactivation of accounts. The backend remains the authorization boundary; the UI and API never return password hashes.
- **Application history** is a dedicated page. Search an application ID to retrieve its existing read-only audit history, then filter those entries by date, action, and officer. It does not search across all applications at once.
- **Settings** includes read-only profile details, persistent English/Odia preference, compact/comfortable table preference, and confirmed sign-out that removes the local access token. Profile editing, password changes, password reset and session revocation are not implemented.
- Playwright browser tests cover login/dashboard, application search/details, document upload/review, admin-only team management, field-officer verification, approval/rejection/return/resubmission, audit history, language preferences and mobile navigation. They start isolated API/frontend servers, copy only fictional seed data into a temporary JSON store, and remove that store at teardown. The API and frontend ports 5508 and 5175 must be available.
- The frontend has no separate component/unit test suite. Automated browser scenarios do not replace manual assistive-technology, cross-browser, tablet or full production-environment testing. Focus indicators, skip navigation, labeled controls, modal keyboard handling and responsive layouts are implemented, but no formal accessibility conformance audit has been performed.
- MongoDB code paths are type-checked but are not exercised by the automated integration suite; configure and test a MongoDB instance separately before relying on that adapter.
- AI uses OpenAI when configured; automated tests mock the provider, so they do not verify live model availability or response quality.
- Demo sample data and static layout metrics are not official operational data. Validate the applicable process, document rules, translations, access policy, deployment controls and legal/privacy requirements before any real-world use.
