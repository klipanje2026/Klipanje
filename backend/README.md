# Django backend

Django 5.2 LTS + Django REST Framework. Local defaults: SQLite, private filesystem storage, session authentication with CSRF. Python 3.12+.

Run commands from the repository root using `node scripts/backend.mjs <command>`:

- `migrate`: create/update the database.
- `test`: run backend tests with an isolated database and mocked AI calls.
- `createsuperuser`: create an administrator for `/admin/` and the existing CRM.
- `check`: check Django configuration.

Normal development uses two terminals. Activate the root `.venv`, enter `backend`, and run `python manage.py runserver`: the project's runserver command defaults to **127.0.0.1:8002**, preserving normal Django auto-reload and CLI options. In another terminal enter `frontend` and run `npm run dev`: Vite uses **127.0.0.1:5175** and proxies `/api` to port 8002. Django admin is on port 8002. The root `npm run dev` also runs only the frontend. `npm run dev:all` and `3-POKRENI.cmd` retain the optional combined launcher (without backend auto-reload).

Use the same hostname consistently. Project-specific cookies (`titlovi_sessionid`, `titlovi_csrftoken`) prevent collisions with other Django projects on localhost; cookies themselves are not isolated by port. Changing ports requires updating the frontend proxy and CSRF trusted origins together.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Service health |
| GET | `/api/auth/csrf` | CSRF token and cookie |
| GET | `/api/auth/me` | Current user and memberships |
| POST | `/api/auth/register` | Create user and personal workspace |
| POST | `/api/auth/login`, `/api/auth/logout` | Session login/logout |
| GET, POST | `/api/projects` | List accessible projects / create project |
| GET, PATCH, DELETE | `/api/projects/{id}` | Read, update or delete accessible project |
| GET, POST | `/api/projects/{id}/assets` | List/upload media |
| GET | `/api/assets/{id}/content` | Authorized file download |
| DELETE | `/api/assets/{id}` | Delete accessible asset |
| POST | `/api/transcribe` | Issue a short-lived ElevenLabs transcription token |
| GET | `/api/voices`, `/api/elevenlabs-status` | Existing voice selector and account status |
| POST | `/api/narration`, `/api/voice-change?voiceId=...` | Existing audio functions |
| POST | `/api/leads`, `/api/bookings` | Preserved public website forms |
| GET, PATCH | `/api/studio/leads` | Staff-only CRM |

All project, file and AI endpoints require a session. Unsafe authenticated requests require `X-CSRFToken`; login and registration also enforce CSRF before authentication. Never replace membership filters with frontend-only checks. CRM is a global staff-only area, separate from client workspaces.

Project `state` is versioned JSON; files are referenced by IDs. Files are not stored in the database. Both editors save snapshots explicitly, not automatically. Old assets and failed/interrupted uploads remain attached until project deletion. This avoids removing files still referenced by another open editor; a retention/cleanup job should be added before enabling cloud storage at scale.

## Storage and Backblaze

`STORAGE_BACKEND=local` uses `backend/media/`. There is deliberately no public `/media/` route. `FileField` uses Django's configurable storage abstraction; code does not require local file paths.

The optional B2 adapter uses `django-storages` and its S3-compatible backend. It remains inactive until `STORAGE_BACKEND=b2` and all five `B2_*` settings are supplied. Create a **private** bucket and a restricted application key; use the endpoint and region shown by Backblaze. Configure bucket CORS for the final frontend origin because authorized downloads redirect to short-lived signed URLs. Test real upload/download/delete permissions before enabling it.

Changing the storage setting does **not** migrate existing files. Before switching, copy local objects under their exact stored keys, verify sizes/checksums and permissions, and retain a backup of the database and files. No cloud account or bucket has been created by this migration.

Reference: https://django-storages.readthedocs.io/en/latest/backends/s3_compatible/backblaze-B2.html

## Before a public product launch

This migration provides a local development foundation, not a completed subscription platform. Next steps include PostgreSQL, durable job queues and workers for long tasks, per-workspace billing/usage limits, signup/login throttling, password reset and email verification, monitoring, backups, upload validation/scanning and a final media retention policy. Concurrent editing needs revision conflict handling before enabling collaborative editing. Team invitation and role-management screens are not implemented; memberships can currently be managed by a trusted administrator.

AI uses the server's shared ElevenLabs key, and the current account status is the provider account's total, not a per-client allowance. Transcription still sends prepared audio directly to ElevenLabs using a single-use token. Narration and voice change pass through Django. Do not describe AI as offline. Video rendering remains in the browser; closing the page stops it. No FFmpeg/Celery service has been introduced in this local migration.

For deployment set a strong `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=false`, explicit allowed hosts/CSRF origins, HTTPS, an appropriate application server and static frontend host. Never deploy Django's development server or Vite's development server. The former Sites configuration is archived and does not deploy Django.
