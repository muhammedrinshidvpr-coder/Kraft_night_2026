const originalFetch = globalThis.fetch;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("AI actions reject requests without an authenticated manager session", async () => {
  const { handleRequest } = await import(`./index.ts?test=${crypto.randomUUID()}`);
  const response = await handleRequest(new Request("https://function.test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "plan_event", prompt: "Create a wedding event." }),
  }));
  const body = await response.json();

  assert(response.status === 401, "expected an unauthenticated request to be rejected");
  assert(body.error?.code === "authentication_required", "expected a safe authentication error");
});

Deno.test("plan_event persists only validated Gemini blueprints", async () => {
  Deno.env.set("SUPABASE_URL", "https://project.test");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  Deno.env.set("GEMINI_API_KEY", "gemini-key");

  let persistedDrafts = 0;
  let createdEvents = 0;
  let applyCalls = 0;
  let returnMalformedBlueprint = false;
  let profileRole = "manager";
  let hasEventMembership = false;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/auth/v1/user")) {
      return Response.json({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" });
    }
    if (url.includes("/rest/v1/profiles")) {
      return Response.json([{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", role: profileRole }]);
    }
    if (url.includes("/rest/v1/event_members")) {
      return Response.json(hasEventMembership ? [{ id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" }] : []);
    }
    if (url.includes("generativelanguage.googleapis.com")) {
      const blueprint = returnMalformedBlueprint
        ? { title: "Incomplete event", venue: "Main Auditorium" }
        : {
          title: "Kraft Night 2026",
          venue: "Main Auditorium",
          groups: [{ name: "Stage" }],
          roleSlots: [{ title: "Stage Lead", responsibility: "Coordinate stage changes", groupIndex: 0 }],
          programmes: [{ title: "Opening", startTime: "2026-09-20T18:00:00Z" }],
        };
      return Response.json({
        candidates: [{ content: { parts: [{ text: JSON.stringify(blueprint) }] } }],
        usageMetadata: { totalTokenCount: 42 },
      });
    }
    if (url.includes("/rest/v1/ai_event_blueprints")) {
      persistedDrafts += 1;
      return Response.json({
        id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        blueprint: {
          title: "Kraft Night 2026",
          venue: "Main Auditorium",
          groups: [{ name: "Stage" }],
          roleSlots: [{ title: "Stage Lead", responsibility: "Coordinate stage changes", groupIndex: 0 }],
          programmes: [{ title: "Opening", startTime: "2026-09-20T18:00:00Z" }],
        },
      });
    }
    if (url.includes("/rest/v1/rpc/apply_ai_event_blueprint")) {
      applyCalls += 1;
      return Response.json({
        event_id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
        event_title: "Kraft Night 2026",
        event_venue: "Main Auditorium",
        event_status: "draft",
      });
    }
    if (url.includes("/rest/v1/events")) createdEvents += 1;
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  try {
    const { handleRequest } = await import(`./index.ts?test=${crypto.randomUUID()}`);
    const response = await handleRequest(new Request("https://function.test", {
      method: "POST",
      headers: { Authorization: "Bearer user-token", "Content-Type": "application/json" },
      body: JSON.stringify({ action: "plan_event", prompt: "Plan a one-hour opening programme." }),
    }));
    const body = await response.json();

    assert(response.status === 200, "expected a successful draft response");
    assert(body.blueprintId === "cccccccc-cccc-cccc-cccc-cccccccccccc", "expected the persisted blueprint id");
    assert(body.usage.totalTokenCount === 42, "expected safe Gemini usage metadata");
    assert(persistedDrafts === 1, "expected exactly one blueprint draft to be persisted");
    assert(createdEvents === 0, "planning must not create an event before confirmation");

    returnMalformedBlueprint = true;
    const rejectedResponse = await handleRequest(new Request("https://function.test", {
      method: "POST",
      headers: { Authorization: "Bearer user-token", "Content-Type": "application/json" },
      body: JSON.stringify({ action: "plan_event", prompt: "Plan another event." }),
    }));

    assert(rejectedResponse.status === 422, "expected malformed Gemini JSON to be rejected");
    assert(persistedDrafts === 1, "malformed Gemini JSON must not be persisted");

    const appliedResponse = await handleRequest(new Request("https://function.test", {
      method: "POST",
      headers: { Authorization: "Bearer user-token", "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "apply_event_blueprint",
        blueprintId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        eventTitle: "Kraft Night 2026",
        venue: "Main Auditorium",
        groups: [{ name: "Stage" }],
        roleSlots: [{ title: "Stage Lead", responsibility: "Coordinate stage changes", groupIndex: 0 }],
        programmes: [{ title: "Opening", startTime: "2026-09-20T18:00:00Z" }],
      }),
    }));
    const appliedBody = await appliedResponse.json();
    assert(appliedResponse.status === 200, "expected a manager-confirmed blueprint to apply");
    assert(appliedBody.event.event_id === "dddddddd-dddd-dddd-dddd-dddddddddddd", "expected the atomic RPC event result");
    assert(applyCalls === 1 && createdEvents === 0, "apply must use the single atomic RPC rather than direct client writes");

    profileRole = "volunteer";
    hasEventMembership = true;
    const nonManagerResponse = await handleRequest(new Request("https://function.test", {
      method: "POST",
      headers: { Authorization: "Bearer user-token", "Content-Type": "application/json" },
      body: JSON.stringify({ action: "plan_event", prompt: "Plan an event." }),
    }));
    assert(nonManagerResponse.status === 403, "expected a non-manager request to be rejected");
    assert(persistedDrafts === 1, "non-manager requests must not persist blueprints");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
