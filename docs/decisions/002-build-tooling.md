# 002 — Build tooling: OpenCode agent, Drizzle ORM, npm workspaces

Date: 2026-10-27
Status: accepted

## Context

`PLAN.md` decision D2 (AI coding tool used to build) was open, and the plan allowed either Prisma or Drizzle for database access.

## Decision

- D2: the project is built with the **OpenCode AI coding agent** (GLM model), with the owner reviewing and testing every iteration.
- Database access via **Drizzle ORM** with SQL migrations (`drizzle-kit`).
- Package management via **npm workspaces** at the monorepo root (pnpm is not installed on the machine).

## Why

- Drizzle: lightweight, SQL-shaped queries, first-class Neon support, migrations live as readable SQL files.
- npm workspaces: available tooling; no extra install step for a fresh clone.

## Revisit when

If Drizzle migrations become a bottleneck for complex changes, or a second package manager is required by hosting.
