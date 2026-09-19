# Secure AI Routing and Event Blueprints

Status: IN PROGRESS

## Goal

Use deterministic live event data for simple manager questions and the secure Gemini Edge Function only for complex, generative event planning. Make the selected path visible in the AI rail and require an editable manager confirmation before creating a new event.

## Decisions

- Simple factual questions use no model tokens.
- Gemini is manager-only, automatically selected for complex prompts, and can be explicitly requested by a manager.
- Gemini plans create new events only.
- Generated roles are persisted as unfilled role slots.
- Supabase is the persistence target for confirmed plans.
- Gemini keys remain Supabase secrets and never enter browser configuration.

## Data Models

- `ai_event_blueprints`: draft event plan owned by a manager. Fields: id, manager_id, prompt, blueprint JSON, status (`draft|applied|failed`), applied_event_id, created_at.
- `event_role_slots`: unfilled organizational role. Fields: id, event_id, group_id nullable, title, responsibility, assigned_member_id nullable, created_at.
- RPC `apply_ai_event_blueprint(blueprint_id, event_title, venue, groups, role_slots, programmes)`: validates draft ownership and atomically creates a draft event, manager membership, groups, role slots, optional programmes, and marks the blueprint applied.

## Contracts

- `routePrompt(prompt, state, options)` guarantees `{ route: "local"|"gemini", reason }`; factual recognized prompts route locally, explicit Gemini and planning verbs route to Gemini, unknown prompts stay local with guidance.
- `getLocalResponse(prompt, state)` returns only current state-derived content and does not fetch or mutate data.
- `ai-coordinator` action `plan_event` requires an authenticated manager and returns `{ blueprintId, blueprint, usage }`; it validates Gemini JSON before storing a draft.
- `ai-coordinator` action `apply_event_blueprint` requires the same manager and returns the newly created event summary. It never accepts an arbitrary provider response.
- The UI shows response provenance and never applies a blueprint without the manager confirmation action.

## Boundaries

In scope: AI rail, gateway planning entry, Edge Function proxy, AI-only migrations, manager access checks, test coverage, and setup documentation.

Out of scope: replacing all existing localStorage workflows, assigning real people to generated roles, streaming model output, and changing unrelated invitation work.

Must not: expose Gemini credentials, trust browser role fields server-side, or alter existing legacy schema files that conflict with deployed environments.

## Orchestration

Manager input -> local classifier -> local state response OR secure Edge Function -> Gemini structured blueprint -> validated draft -> editable preview -> manager confirmation -> transactional Supabase RPC -> new draft event -> workspace refresh.

## Error Handling

- Local route remains available without Supabase or Gemini.
- Gemini timeout, provider error, malformed output, authorization failure, or persistence failure returns a clear non-destructive UI state.
- No record is created before Gemini output passes validation; the RPC rolls back all creation work on failure.

## Verification

| After step | Verify by | Fail action |
| --- | --- | --- |
| Router added | Browser smoke test proves factual prompt has a Live event data badge and does not call fetch | Fix classification before UI work |
| Edge/migration added | Deno type/lint check and locally mocked function request | Fix response contract before wiring client |
| Preview wired | Browser smoke test renders editable blueprint only after mocked Gemini response | Fix UI state before apply action |
| Apply wired | Supabase integration test creates event/groups/role slots atomically | Fix RPC before release |
| Complete | Browser E2E manager/non-manager/error/mobile paths | Root-cause before shipping |

## Task Breakdown

1. Add pure client routing and state-derived factual responses. Depends on none.
2. Add isolated AI migration and secure Edge Function request/response validation. Depends on database environment inspection before deploy.
3. Add manager-only route/status UI and editable plan preview. Depends on task 1; uses task 2 contract.
4. Add browser smoke coverage with a mocked Edge boundary. Depends on tasks 1 and 3.
5. Update setup documentation and deploy/rotation checklist. Depends on task 2.

## Acceptance Criteria

- A factual manager question is answered from current event state with a visible `Live event data` source and no Gemini request.
- A complex manager prompt results in a visible `Gemini plan` preview through the Edge Function only.
- Confirming an edited blueprint creates a separate draft event with groups and unfilled role slots in Supabase.
- Non-managers cannot access AI actions in the UI or invoke plan/apply actions successfully.
- Gemini provider failures cannot create partial events.
