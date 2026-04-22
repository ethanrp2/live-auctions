# Memory Schema

How this memory system works. Read this first when onboarding yourself into the project — whether "yourself" is future-me tomorrow or a new engineer next month.

## Model

Three layers, adapted from Karpathy's LLM-wiki pattern:

1. **Raw sources** — the code, the Supabase schema, the Figma file, the Basta docs, `GAP_ANALYSIS_AND_PLAN.md`, PR descriptions, Slack threads. Immutable truth. Never paraphrase here; link to them.
2. **Wiki (this directory)** — compiled synthesis of the raw sources. Durable pages I maintain as the system changes. This is what gets read at session start.
3. **Schema (this file + `INDEX.md`)** — rules for how the wiki is organized and maintained.

The core principle: **memory is synthesis, not retrieval**. Raw facts that only matter in the moment go in `log.md` and decay. Facts that compound into system understanding get compiled into `architecture/` or `decisions/` pages.

## Directory layout

```
docs/memory/
├── SCHEMA.md              # this file — rules for everything below
├── INDEX.md               # one-line catalog of every page
├── log.md                 # append-only chronological log, [YYYY-MM-DD] prefixed
│
├── architecture/          # compiled synthesis — "how X works today"
├── decisions/             # ADRs — one file per decision, numbered
├── risks/                 # open questions, external blockers, what's unresolved
├── glossary/              # domain terms
└── sessions/              # end-of-session handoff, one file per session
```

## The rules

1. **Dates are ISO and ever-present.** `[YYYY-MM-DD]` for days, `[YYYY-MM-DD HH:MM TZ]` for precise events. No relative dates ("yesterday", "last week") — they go stale the moment you write them.

2. **`INDEX.md` is the entry point.** Every new page in this directory must add one line to INDEX.md with a one-sentence hook. Never write prose content directly into INDEX.md — it's a catalog, not a document.

3. **Compile, don't dump.** If the same fact appears in two log entries, promote it into the right compiled page and replace the log mentions with a pointer. A memory system that doesn't compound is just a junk drawer.

4. **Each session ends with a `sessions/YYYY-MM-DD.md` handoff.** Five bullets, one each:
   - **Did** — what I actually shipped.
   - **Works** — what's verified end-to-end.
   - **Broken** — known failures + what I haven't checked.
   - **Stopped at** — the exact file/line/command where I stopped.
   - **Next** — first thing I do tomorrow.
   
   Future-me opens this file first. Don't write essays.

5. **`log.md` is append-only.** Chronological, one line per meaningful event, ISO-prefixed. When a log line reveals durable truth, lift it to a compiled page and replace the log line with a link. Don't edit history.

6. **Decisions get ADRs.** If it's irreversible, or I'd explain it to a new engineer, or it's the answer to "why did you do it this way" — it's an ADR. Filename `decisions/ADR-NNN-<slug>.md`. Sections:
   - **Status** — Proposed / Accepted / Superseded by ADR-MMM.
   - **Context** — what forced the decision.
   - **Decision** — what we chose.
   - **Consequences** — what follows (good and bad).
   - **Date** — accepted on.
   - **Supersedes / Superseded by** — if relevant.
   
   Keep to one page.

7. **Risks are tracked, not forgotten.** Every open question, external blocker, or flaky dependency lives in `risks/<area>.md`. Fields per risk:
   - **Question/risk** — what's unresolved.
   - **Owner** — me (default) or an external party.
   - **Trigger** — what event resolves it (e.g., "Basta support email reply", "Stripe KYC complete").
   - **Blocks** — which milestones/features.
   - **Opened** — date.
   - **Status** — Open / Resolved (with date + resolution).
   
   Resolved risks move to an `## Archive` section at the bottom of the file (never deleted; future me might need the context).

8. **Stale = dangerous.** Every compiled page has a `Last verified: YYYY-MM-DD` footer. If a page's claims aren't re-verified within 60 days, add a `⚠ STALE` banner at the top on next encounter. Either re-verify (bump the date) or delete.

9. **Cross-reference aggressively.** Use relative markdown links, not repeated prose. If Stripe Connect is mentioned in three places, all three should link to `architecture/payments.md` (or wherever the truth lives) rather than restate.

10. **Commit memory changes with the code changes they describe.** Same PR, same commit when possible. Drift between code and memory is the failure mode of this whole system. If you edit memory without code, or code without memory, one of them is wrong.

## Session lifecycle

**Session start (~60s):**
1. Read `sessions/<most-recent>.md`.
2. Read `INDEX.md` headers; scan for anything flagged `⚠ STALE`.
3. Skim the tail of `log.md` for last few events.
4. Check `risks/*.md` for externally-blocked items I might be able to unblock.

**During session:**
- Append to `log.md` as interesting events happen (not after — you'll forget).
- When a log line reveals a durable truth, compile it into the right page right then.
- Keep the todo list (Claude Code's TodoWrite or an equivalent scratchpad) for in-flight work — that's **not** memory, it's working RAM.

**Session end (~5 min):**
- Write `sessions/YYYY-MM-DD.md` (template in the `sessions/` directory).
- Update `INDEX.md` for any new pages.
- Lint pass: any `⚠ STALE` banners to resolve or add? Any risks to close?
- Commit.

## What does NOT go here

- **Code.** Code lives in `app/`, `backend/`, `components/`, etc. Don't duplicate it.
- **Things derivable from the code in under 30 seconds.** If `Grep` or `Read` finds it faster than reading this doc, don't write it here.
- **Task lists, in-flight work, TODOs.** Those are working RAM (TodoWrite, GitHub issues, branch names). This is durable synthesis.
- **Meeting notes, customer calls.** Unless they produced a durable decision (ADR) or risk, keep them elsewhere.
- **Credentials, secrets, tokens.** Ever. Env vars go in `.env.example` with descriptions, not here.

## Adding a new page

1. Decide the section: is this how the system *works today* (`architecture/`), a *decision made* (`decisions/`), an *unresolved question* (`risks/`), or a *term you might forget* (`glossary/`)?
2. Create the file with the appropriate template (copy from an existing page in that section).
3. Add a one-line entry to `INDEX.md`.
4. Link to it from any related pages.
5. Commit with the code change that prompted it.

## Linting (manual, periodic)

Every ~2 weeks:
- Grep for `Last verified:` and flag anything >60 days.
- Check `INDEX.md` is complete (compare to `ls architecture/ decisions/ risks/ glossary/`).
- Check for orphans (pages no other page links to — maybe they should be merged or deleted).
- Check for contradictions (search for key terms across pages and confirm they agree).

If this lint is painful, the memory system is too big. Prune it.

---

_Last verified: 2026-04-21_
