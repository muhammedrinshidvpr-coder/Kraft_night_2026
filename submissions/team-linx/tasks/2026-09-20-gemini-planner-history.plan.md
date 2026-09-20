# Gemini Planner Reset + Session & Access Event History

Status: COMPLETE (verified 2026-09-20: `npx playwright test tests/ai-routing.spec.js` 3/3 passed, twice consecutively)
Source: discovery grill 2026-09-20 (12 questions, all resolved)

## Goal

Fix silent Gemini failures and preset/programme stacking. Every `Plan with Gemini` session starts clean, gateway return resets the active workspace, and every manager-owned event is stored in clickable Session & Access history with full-snapshot restore.

## Decisions

- Session & Access means the existing `profile-popover` panel (`index.html:409-465`).
- History is clickable and restores the full snapshot (event, groups, programmes, roster, messages, role slots).
- Gemini unavailable shows a visible error with Retry and preserves the selected preset; no silent local fallback for `forceGemini`.
- Returning to gateway via Change/Find Event clears the active workspace immediately; the cleared event stays in history.
- History is persistent, manager-scoped, cross-device via Supabase with localStorage as cache.
- History cards show title, venue, PIN, status, creation date, Switch action; current event is marked.
- New planner sessions reset to the 24-Hour Hackathon preset plus any gateway title.
- Closing/cancelling discards the transient draft.
- Deployed Gemini requires a real authenticated Supabase manager session; no mock-mode Gemini.
- History includes normal, CSV, AI-rail, and planner events owned by the manager; retained until explicit archive/delete exists.
- CSV import binding is out of scope beyond ensuring created events (when wired later) reuse the same history helper.

## Data Models

- `EventHistoryEntry`: id, title, venue, sixDigitCode/six_digit_code, status, manager_id/managerId, created_at.
- `EventSnapshot`: event, groups[], programmes[], joinedPeople[], messages{}, roleSlots[].
- Local cache: existing `sangam_all_events` index plus new `sangam_event_snapshots` map keyed by event id.
- Supabase source of truth: `events` filtered by `manager_id = auth user id`; per-event `event_groups`, `event_members`, `programmes`, `event_role_slots`.

## Contracts

- `getManagerEventHistory()` returns only the signed-in manager's entries, Supabase-first when live, local cache otherwise.
- `saveEventToHistory(entry, snapshot)` upserts index + snapshot and never deletes other manager entries.
- `clearActiveWorkspacePreservingHistory()` persists the current snapshot, then clears current event/groups/programmes/roster/messages/roleSlots and planner transient state.
- `loadEventSnapshot(eventId)` replaces the entire active workspace from Supabase or local snapshot; empty remote collections replace (not merge) local state.
- `resetPlannerForNewSession(title)` always selects hackathon, clears prompt/title/venue/rows/error state, then applies the gateway title.
- `aiCoordinator.respond(prompt, ctx, {forceGemini:true})` requires live backend plus Supabase session; otherwise it throws a manager-sign-in error and never calls direct Gemini or local generation.

## Orchestration

- Gateway `Plan with Gemini` -> `resetPlannerForNewSession(gateway title)` -> open modal.
- Planner Generate/Enhance -> authenticated Edge `plan_event` only -> success renders blueprint; failure shows `Gemini unavailable: <reason>` with Retry and keeps preset.
- Planner Create -> require real manager -> Supabase `events` + `event_groups` + `programmes` + `event_members` + `event_role_slots` (best effort) -> local snapshot + history -> Session & Access refresh -> dashboard.
- Change/Find Event or gateway entry -> persist snapshot -> clear active workspace + planner draft -> render gateway with empty title field.
- Session & Access open -> `getManagerEventHistory()` renders current card plus history list.
- History Switch -> persist current snapshot -> `loadEventSnapshot(target)` -> refresh dashboard/groups/roster/chat/about/stats -> close popover.

## Boundaries

In scope: `js/ai.js`, `js/event-planner.js`, `js/main.js`, `js/config.js`, `index.html` Session & Access history UI, `style.css` history styles, AI migration note if needed, Playwright coverage for reset/history.

Out of scope: CSV import binding, RLS policy rewrite, streaming model output, archive/delete UI, altering legacy UUID migrations.

Must not: expose Gemini keys in browser, trust browser role fields server-side, run legacy UUID migrations against text-ID production schema, delete other managers' history entries.

## Amendment 2026-09-20: temporary browser-key testing exception

At the owner's explicit request (test-only key, to be revoked after testing),
a gated testing fallback exists: `app/env.js` (git-ignored, never committed or
deployed) may hold `ENV_GEMINI_API_KEY` plus `ENV_ALLOW_BROWSER_GEMINI_TESTING`.
`js/config.js` exposes `isBrowserGeminiTestMode()`; the flag/key are read live
at call time. `js/ai.js` uses the Edge Function first and only falls back to a
direct browser call when the flag is on — results are labeled
`Gemini 2.5 Flash (browser test key)` so test output is never mistaken for
production. Without the flag, behavior stays strict Edge-only with a visible
error and zero direct Google calls (covered by both regression tests).
Revoke the key in Google AI Studio and set the flag to false before any shared
or production use.

Must follow: text-ID Supabase schema (`supabase/schema.sql` + `09_ai_event_blueprints.sql`), Edge Function manager checks, existing localStorage key conventions.

## Error Handling

- No Supabase session or non-manager: planner Generate and Create throw `Sign in as an event manager` / `Only event managers can use Gemini planning`; nothing is created.
- Gemini timeout/provider/malformed/persistence failure: visible planner error badge, Generate re-enabled for Retry, preset unchanged, no partial event.
- History load failure: keep the current workspace, show a non-destructive alert/log, do not clear state.
- Supabase event creation failure after blueprint validation: local snapshot/history still created so the manager does not lose work; remote error is logged.

## Verification

| After step | Verify by | Fail action |
| --- | --- | --- |
| AI routing hardened | `respond` with `forceGemini` and no session throws; no `generativelanguage` fetch from browser | Remove fallback before UI work |
| Planner reset | Open planner twice with different presets; second open is clean hackathon | Fix reset before history work |
| Gateway reset | Change/Find Event clears current event/groups/programmes but preserves history | Fix reset before snapshot work |
| History + switching | Create two events, switch via Session & Access, each workspace snapshot is isolated | Fix snapshot persistence before release |
| Full flow | Playwright gateway planner + history spec passes | Root-cause before shipping |

## Acceptance Criteria

- Generate with Gemini without a real manager session shows a sign-in error and creates nothing.
- Selecting a second preset after gateway return does not stack programmes from the prior plan.
- Returning to gateway clears the active workspace while preserving history.
- Session & Access lists all current/previous manager events with title, venue, PIN, status, creation date, Switch action, and current marker.
- Selecting history restores that event's departments, programmes, members, and chat without cross-event leakage.
- Normal-form events also appear in the same history.

## Task Breakdown

1. Harden `js/ai.js` Gemini-only path (runner). Depends on none.
2. Reset planner open/close/generate/create in `js/event-planner.js` (builder). Depends on 1.
3. Add history storage helpers in `js/config.js` (runner). Depends on none.
4. Gateway reset + history persistence/switching in `js/main.js` (builder). Depends on 2 and 3.
5. Session & Access history UI in `index.html` + `style.css` (runner). Depends on 4.
6. Playwright reset/history coverage (runner). Depends on 2-5.
