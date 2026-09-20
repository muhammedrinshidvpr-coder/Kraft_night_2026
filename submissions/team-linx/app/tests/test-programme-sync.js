// Programme sync regression guard (no backend required).
// Verifies the shared-schedule authority contract statically:
// - server is authoritative per active event, realtime is event-filtered
// - failed manager writes roll back with Retry (never masquerade as shared)
// - planner uses the transactional creation path (no continue-locally)
// - manager-only recovery uses replace_event_programmes (no auto-merge)
// - RLS enforces manager-of-that-event writes
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

let failures = 0;
function check(name, cond, detail = "") {
  if (cond) {
    console.log(`PASS — ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL — ${name}${detail ? ` (${detail})` : ""}`);
  }
}

const tasks = read("js/tasks.js");
const main = read("js/main.js");
const planner = read("js/event-planner.js");
const html = read("index.html");
const migration = read("supabase/migrations/11_programme_sync_security.sql");

// 1. Active-event authority + filtered realtime.
check("tasks exposes setActiveEvent", tasks.includes("async setActiveEvent("));
check("tasks reloads authoritative schedule incl. empty", tasks.includes("Empty server schedule MUST clear stale") || tasks.includes("Authoritative replace"));
check("realtime subscription is event-filtered", tasks.includes("filter: `event_id=eq.${eventId}`"));
check("realtime defensively drops other events", tasks.includes("incomingEventId !== this.activeEventId"));
check("slow event loads cannot overwrite a newer event", tasks.includes("this.activeEventId !== eventId) return"));
check("subscription closes the initial fetch race", tasks.includes("this.refreshActiveEvent({ subscribe: false })"));
check("event switch tears down realtime", tasks.includes("teardownRealtime()") && tasks.includes("clearActiveEvent()"));

// 2. Awaited writes with rollback + retry.
check("failed add rolls back", tasks.includes("rollbackAdd("));
check("failed update restores previous", tasks.includes("const previous = { ...this.programmes[idx] }"));
check("failed delete restores removed row", tasks.includes("Programme delete reverted"));
check("retryable pending operation exists", tasks.includes("retryPendingOperation()"));
check("sync error surface exists", tasks.includes("setSyncError(") && tasks.includes("getLastSyncError("));

// 3. Lifecycle wiring.
check("main activates sync for current event", main.includes("activateProgrammeSyncForCurrentEvent()"));
check("main captures manager backup before replace", main.includes("captureManagerScheduleBackup()"));
check("main renders sync notice", main.includes("renderProgrammeSyncNotice()"));
check("manager publish uses transactional RPC", main.includes('rpc("replace_event_programmes"'));
check("publish asks explicit confirm, never merges", main.includes("REPLACES the server schedule"));

// 4. Planner uses the safe transactional path.
check("planner delegates to createEventFromBlueprint", planner.includes("createEventFromBlueprint(blueprint)"));
check("planner does not insert programmes directly", !planner.includes('.from("programmes").insert'));
check("planner does not continue locally after failure", !planner.includes("continuing locally"));
check("live event creation refuses local-only fallback", main.includes("No local-only event was created."));

// 5. Notice UI exists.
check("workspace has sync notice", html.includes('id="programme-sync-notice"'));
check("notice has retry", html.includes('id="programme-sync-retry"'));
check("recovery has publish + keep-shared", html.includes('id="programme-sync-publish"') && html.includes('id="programme-sync-dismiss"'));

// 6. Server enforcement migration.
check("migration drops public programme write", migration.includes('drop policy if exists "Programmes Public Write"'));
check("migration adds manager-of-event policies", migration.includes("Managers write own event programmes") && migration.includes("Managers delete own event programmes"));
check("migration adds transactional replace RPC", migration.includes("create or replace function public.replace_event_programmes"));
check("RPC checks event manager", migration.includes("Only the event manager can publish the schedule."));
check("migration keeps realtime publication", migration.includes("supabase_realtime") && migration.includes("programmes"));

if (failures > 0) {
  console.error(`\n${failures} programme-sync regression check(s) failed.`);
  process.exit(1);
}
console.log("\nAll programme-sync regression checks passed.");
