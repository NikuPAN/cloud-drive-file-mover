# Agent notes: cloud-drive-file-mover

Durable notes for AI agents working on this project: decisions with their reasons, gotchas, and
Nick's rules for it. Moved here on 2026-11-06 from Claude Code's PC-only memory
(`~/.claude/projects/<folder>/memory/`), which is now switched off, so this folder is the project's
memory and travels with the code.

- One fact per file. Front matter: `name`, `description`, `type` (user, feedback, project, reference).
  Feedback and project notes carry **Why:** and **How to apply:** lines.
- Read the note for a topic before working on it. When you learn something a cold agent would get
  wrong, add a note and a line below in the same commit; update or delete notes that turn out wrong.
- `[[name]]` links point to another note by file name; a few point to notes in other projects.

## Notes

- [Project overview](project_overview.md) — Cloud Drive File Mover: GDrive↔OneDrive, SvelteKit + TypeScript (.NET 10 dropped), privacy-first

`local/` (if present) holds PC-only notes and is excluded from git.
