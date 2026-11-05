# Cloud Drive File Mover

Free, open-source, privacy-first web app that moves files between cloud drives. Setup, OAuth app
registration and architecture: `README.md`. **This repo is public**: nothing personal or secret goes in
it, and `.env` is never committed.

## Stack
SvelteKit 2 + Svelte 5 runes + TypeScript, Tailwind CSS v4, Paraglide JS v2 (en, zh-Hant, zh-Hans, ja;
messages in `messages/`), Arctic (OAuth 2.0 + PKCE) and `jose` (JWE-encrypted session cookie). No
database, no cache, no logging of user data.

## Layout
- `src/lib/server/` — `oauth.ts`, `session.ts` (tokens live only in the encrypted HttpOnly cookie),
  `transfer.ts` (streams bytes in memory, resumable uploads), `providers/` (`google`, `microsoft`,
  `dropbox`, `box` behind `types.ts`)
- `src/routes/api/` — `auth/<provider>` (login + callback, `logout`), `drive`, `transfer` (progress over
  Server-Sent Events)
- `src/routes/transfer`, `src/routes/donate` (PayPal button, placeholder when unset)

## Commands
- `npm run dev` (http://localhost:5173) · `npm run check` (typecheck) · `npm run build` · `npm run preview`
- Env: copy `.env.example` to `.env`; keys for Google, Microsoft, Dropbox and Box OAuth, `PUBLIC_ORIGIN`,
  `SESSION_SECRET`, optional `PUBLIC_PAYPAL_BUTTON_ID`.

## Rules and gotchas
- Default to the privacy-preserving choice: tokens in the session cookie only, no persistence of user or
  file data. Keep the UX a one-job tool, not a sync platform.
- The code has four providers (Google Drive, OneDrive, Dropbox, Box), but `README.md` still describes only
  Google Drive ↔ OneDrive. Update the README when touching providers.
- Every UI string goes through Paraglide in all four locales; light, dark and system themes.

## Agent notes (project memory)

This project's memory lives in `docs/agent-notes/`, committed with the code (moved from Claude Code's
PC-only memory on 2026-11-06; auto memory is off). `docs/agent-notes/local/` holds PC-only notes and is
excluded from git. Read the note for a topic before working on it; when you learn something a cold agent
would get wrong, add a note and a line to its README in the same commit. The index:

@docs/agent-notes/README.md
