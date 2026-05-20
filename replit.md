# Chorcha Question Bank Manager

Organize exam questions from chorcha.net into nested folders. Decode MCQ, CQ, and SQ question sets directly from Chorcha URLs into a searchable, editable question bank with math rendering.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/folder-app run dev` — run the frontend (port 24503)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` or `NEON_DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite, Tailwind CSS v4, Wouter router, Framer Motion, KaTeX (math rendering), TanStack Query
- API: Express 5 + Socket.IO (battle mode)
- DB: PostgreSQL + Drizzle ORM (Neon hosted)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/db/src/schema/` — Drizzle ORM schema (`folders.ts`, `questionSets.ts`)
- `artifacts/api-server/src/routes/` — Express route handlers (`folders.ts`, `questionSets.ts`, `chorcha.ts`)
- `artifacts/api-server/src/battle/` — Socket.IO battle mode (real-time MCQ competition)
- `artifacts/folder-app/src/pages/` — React pages (Home, FolderView, QuestionSetView, Battle, etc.)
- `artifacts/folder-app/src/components/folder/` — Folder and question set components

## Architecture decisions

- Contract-first API: OpenAPI spec drives codegen for both React Query hooks and Zod validation schemas
- Dark mode only: forced via `document.documentElement.classList.add("dark")` in ThemeWrapper
- Chorcha decode engine: `chorcha.ts` (~935 lines) — decodes cipher-encoded question data from Chorcha's API, handles MCQ/CQ/SQ types, math auto-detection, HTML sanitization, image absolutization
- All non-API fetch calls (chorcha decode, question patch/delete) use `import.meta.env.BASE_URL` prefix to work through the Replit proxy
- DB cascades: deleting a folder deletes all descendant folders + question sets + questions
- NEON_DATABASE_URL env var is used (DATABASE_URL is Replit runtime-managed)

## Product

- Nested folder manager with custom icons, colors, and card styles (default/square/big/flat/wide)
- Decode Chorcha question bank URLs or single read URLs into question sets
- Questions support MCQ (multiple choice), CQ (creative/srijonshil with parts), SQ (short question)
- Math rendering with KaTeX ($...$ and $$...$$ and \(...\) syntax)
- Browse / Solution / Practice view modes for question sets
- Drag-to-reorder folders and question sets
- Inline question editing (text, options, parts, solution, AI explanation)
- Battle mode: real-time MCQ competition via Socket.IO

## User preferences

- Dark mode only application
- Bengali/English bilingual content (Chorcha is a Bangladeshi exam prep platform)

## Gotchas

- Chorcha decode requires a valid session token from chorcha.net (JWT or cookie string)
- The `chorcha.ts` route uses `req.log` (pino-http) not `console.log`
- Token is saved to localStorage and auto-filled in the decode dialog
- Bank imports use batches of 4 concurrent requests to avoid rate limiting
- DATABASE_URL is runtime-managed by Replit; use NEON_DATABASE_URL to point to Neon

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
