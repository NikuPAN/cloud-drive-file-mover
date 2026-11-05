---
name: Cloud Drive File Mover — project overview
description: Goals, scope, and stack for the cloud-drive-file-mover project (started 2026-04-18)
type: project
---
Free tool to move files between cloud drives. MVP: Google Drive ↔ Microsoft OneDrive (both directions).

**Why:** User believes no free tool currently fills this niche. Privacy-first positioning: disclaimer states no user info stored, no data sold.

**How to apply:** When making suggestions, default toward privacy-preserving choices (tokens in session only, no DB persistence of user/file data). Keep UX simple — this is a one-job tool, not a sync platform.

## Stack (locked 2026-04-18)
- SvelteKit + TypeScript — handles both frontend and backend (server routes for OAuth + streaming)
- .NET 10 dropped: architecturally unneeded; user will save .NET for a project where it earns its keep
- Auth: SSO to Google + Microsoft (OAuth)

## Deployment posture (locked 2026-04-18)
- Google OAuth in **Testing mode** (100-user cap) — no CASA verification burden
- Repo will be **open source** as transparency signal for the no-data-theft promise

## Required features
- SSO login to both drives
- Table of files/folders, user picks what to move
- Pre-transfer size check vs destination free space (warn + block if insufficient)
- Privacy disclaimer
- Light / dark / system theme
- i18n: en, zh-Hant, zh-Hans, ja
- Lazy load + preload for perf
- Second router page: "Buy me a coffee" donation

## Resolved decisions (2026-04-18)
- Transfer: backend streams bytes, never persists; tokens live in session cookies only, never DB
- Folders: recursive, preserve structure
- Filename conflicts: confirmation modal with skip/rename/overwrite
- Google Workspace docs: confirmation modal offering convert-to-Office
- Buy-me-a-coffee URL: TBD, placeholder (`DONATE_URL = '#'`) in `src/routes/donate/+page.svelte`

## Libraries chosen (2026-04-18)
- Tailwind CSS v4 (class-based dark mode via custom-variant)
- Paraglide JS v2 (`@inlang/paraglide-js`) with message-format plugin; messages in `messages/*.json`
- `arctic` (OAuth 2.0 PKCE) + `jose` (JWE A256GCM session cookies)
- `lucide-svelte` icons

## Token-handling contract
- Session cookie `cdfm_session`: HttpOnly, SameSite=Lax, 8h TTL, dir A256GCM JWE, never persisted server-side
- OAuth flow cookies `cdfm_oauth_state_{provider}` + `cdfm_oauth_verifier_{provider}`: 10-min TTL, cleared on callback
- Access tokens auto-refreshed inside each provider class when expiry within 60s window
