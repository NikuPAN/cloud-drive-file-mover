# Cloud Drive File Mover

Move files between **Google Drive** and **Microsoft OneDrive**. Free, open source, privacy-first.

## Privacy

- **No files are stored.** Bytes stream through the backend in-memory only.
- **No account info is stored.** Access tokens live in an encrypted, HttpOnly session cookie on your browser and expire on sign out.
- **No personal data is sold.** Ever.
- Source is public — read every line.

## Features

- Two-way transfer: Google Drive ↔ OneDrive
- Recursive folder transfer, folder structure preserved
- Destination free-space pre-check
- Conflict handling modal: skip / keep both / overwrite
- Google Workspace (Docs/Sheets/Slides) → Office (.docx/.xlsx/.pptx) conversion prompt
- Light / Dark / System theme
- i18n: English, 繁體中文, 简体中文, 日本語
- Lazy-loaded routes with hover preload

## Stack

- SvelteKit 2 + TypeScript + Svelte 5 runes
- Tailwind CSS v4
- Paraglide JS v2 (i18n)
- Arctic (OAuth 2.0) + jose (encrypted session cookies)

## Requirements

- Node.js ≥ 20
- A Google Cloud project with Drive API enabled
- A Microsoft Entra (Azure) app registration with Files.ReadWrite.All

## Setup

### 1. Clone and install

```bash
git clone <this repo>
cd cloud-drive-file-mover
npm install
```

### 2. Google OAuth (Testing mode — up to 100 users)

1. Go to https://console.cloud.google.com/
2. Create a project (or use existing).
3. Enable the **Google Drive API**.
4. **OAuth consent screen** → User Type: External → Publishing status: Testing.
   - Add yourself (and any friends) as Test Users.
   - Add scopes: `.../auth/drive` and `.../auth/drive.readonly` (these are *restricted scopes* — full verification required only if you ever publish).
5. **Credentials** → Create OAuth client ID → Web application.
   - Authorized redirect URI: `http://localhost:5173/api/auth/google/callback`
   - Copy **Client ID** + **Client secret** into `.env`.

### 3. Microsoft OAuth

1. Go to https://entra.microsoft.com/ → App registrations → New registration.
2. Supported account types: **Personal Microsoft accounts + any organizational directory**.
3. Redirect URI: `Web` → `http://localhost:5173/api/auth/microsoft/callback`
4. **Certificates & secrets** → New client secret → copy the secret *value* (not ID) immediately.
5. **API permissions** → Add Microsoft Graph delegated permissions:
   - `Files.ReadWrite.All`
   - `User.Read`
   - `offline_access`
6. Copy **Application (client) ID** + the secret into `.env`.

### 4. Environment

Copy `.env.example` → `.env` and fill in values. Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### 5. Run

```bash
npm run dev          # http://localhost:5173
npm run check        # typecheck
npm run build        # production build
```

## Architecture notes

- OAuth tokens are serialized inside a JWE-encrypted cookie (`jose`, A256GCM, dir). They never touch disk.
- Access tokens are refreshed transparently on expiry; failures fall through to a re-auth prompt.
- File transfer uses resumable uploads on both sides (Google resumable via `X-Upload-Content-*`, OneDrive `createUploadSession` with 10 MiB chunks).
- Workspace documents are exported to Office formats via Google's `/files/{id}/export` endpoint; sizes aren't known ahead of time so exports are buffered (256 MiB cap per doc).
- Progress is streamed to the browser via Server-Sent Events.

## Security posture

- Session cookie: `HttpOnly`, `SameSite=Lax`, `Secure` in production (auto-detected from `PUBLIC_ORIGIN`).
- OAuth state + PKCE verifier stored in short-lived (10 min) cookies per provider; cleared on callback.
- No database. No cache. No logging of user data.

## License

MIT
