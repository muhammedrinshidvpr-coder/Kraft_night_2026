// ==============================================================================
// SANGAM - Supabase Edge Function: ai-coordinator
// Purpose: manager-authorized Gemini planning and confirmed blueprint creation
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-1.5-flash";
const GEMINI_TIMEOUT_MS = 20_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonObject = Record<string, unknown>;

type EventGroup = {
  name: string;
  description?: string;
  icon?: string;
};

type RoleSlot = {
  title: string;
  responsibility: string;
  groupIndex?: number;
};

type Programme = {
  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
  venueOrStage?: string;
};

type EventBlueprint = {
  title: string;
  venue: string;
  groups: EventGroup[];
  roleSlots: RoleSlot[];
  programmes: Programme[];
};

class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(error: AppError) {
  return jsonResponse({ error: { code: error.code, message: error.message } }, error.status);
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new AppError(422, "invalid_blueprint", `${field} must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new AppError(422, "invalid_blueprint", `${field} must be between 1 and ${maxLength} characters.`);
  }

  return trimmed;
}

function optionalString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  return requiredString(value, field, maxLength);
}

function validDateTime(value: string, field: string): string {
  if (Number.isNaN(Date.parse(value))) {
    throw new AppError(422, "invalid_blueprint", `${field} must be a valid date-time.`);
  }
  return value;
}

// Canonicalizing the model output prevents provider-specific or unvalidated fields
// from entering the stored draft or the apply RPC.
function validateBlueprint(value: unknown): EventBlueprint {
  if (!isRecord(value)) {
    throw new AppError(422, "invalid_blueprint", "Gemini did not return an event blueprint object.");
  }

  if (!Array.isArray(value.groups) || !Array.isArray(value.roleSlots) || !Array.isArray(value.programmes)) {
    throw new AppError(422, "invalid_blueprint", "Blueprint groups, roleSlots, and programmes must be arrays.");
  }
  if (value.groups.length > 30 || value.roleSlots.length > 150 || value.programmes.length > 150) {
    throw new AppError(422, "invalid_blueprint", "Blueprint contains too many event items.");
  }

  const groups = value.groups.map((group, index) => {
    if (!isRecord(group)) {
      throw new AppError(422, "invalid_blueprint", `groups[${index}] must be an object.`);
    }
    const description = optionalString(group.description, `groups[${index}].description`, 1_000);
    const icon = optionalString(group.icon, `groups[${index}].icon`, 32);
    return {
      name: requiredString(group.name, `groups[${index}].name`, 120),
      ...(description ? { description } : {}),
      ...(icon ? { icon } : {}),
    };
  });

  const roleSlots = value.roleSlots.map((roleSlot, index) => {
    if (!isRecord(roleSlot)) {
      throw new AppError(422, "invalid_blueprint", `roleSlots[${index}] must be an object.`);
    }

    const groupIndex = roleSlot.groupIndex;
    if (groupIndex !== undefined && groupIndex !== null &&
      (!Number.isInteger(groupIndex) || (groupIndex as number) < 0 || (groupIndex as number) >= groups.length)) {
      throw new AppError(422, "invalid_blueprint", `roleSlots[${index}].groupIndex must reference a generated group.`);
    }

    return {
      title: requiredString(roleSlot.title, `roleSlots[${index}].title`, 120),
      responsibility: requiredString(roleSlot.responsibility, `roleSlots[${index}].responsibility`, 1_000),
      ...(typeof groupIndex === "number" ? { groupIndex } : {}),
    };
  });

  const programmes = value.programmes.map((programme, index) => {
    if (!isRecord(programme)) {
      throw new AppError(422, "invalid_blueprint", `programmes[${index}] must be an object.`);
    }

    const startTime = validDateTime(requiredString(programme.startTime, `programmes[${index}].startTime`, 64), `programmes[${index}].startTime`);
    const endTime = optionalString(programme.endTime, `programmes[${index}].endTime`, 64);
    if (endTime) {
      validDateTime(endTime, `programmes[${index}].endTime`);
      if (Date.parse(endTime) < Date.parse(startTime)) {
        throw new AppError(422, "invalid_blueprint", `programmes[${index}].endTime cannot be before startTime.`);
      }
    }
    const description = optionalString(programme.description, `programmes[${index}].description`, 2_000);
    const venueOrStage = optionalString(programme.venueOrStage, `programmes[${index}].venueOrStage`, 160);

    return {
      title: requiredString(programme.title, `programmes[${index}].title`, 160),
      startTime,
      ...(description ? { description } : {}),
      ...(endTime ? { endTime } : {}),
      ...(venueOrStage ? { venueOrStage } : {}),
    };
  });

  return {
    title: requiredString(value.title, "title", 160),
    venue: requiredString(value.venue, "venue", 160),
    groups,
    roleSlots,
    programmes,
  };
}

function getServerClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new AppError(503, "server_misconfigured", "AI planning is not configured on this server.");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getRequesterClient(authorization: string): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new AppError(503, "server_misconfigured", "AI planning is not configured on this server.");
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
}

async function requireManager(req: Request) {
  const authorization = req.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || !authorization) {
    throw new AppError(401, "authentication_required", "Sign in as an event manager to use AI actions.");
  }

  const server = getServerClient();
  const { data: userData, error: userError } = await server.auth.getUser(token);
  if (userError || !userData.user) {
    throw new AppError(401, "invalid_session", "Your session is invalid or has expired.");
  }

  const { data: profiles, error: membershipError } = await server
    .from("profiles")
    .select("id")
    .eq("id", userData.user.id)
    .eq("role", "manager")
    .limit(1);
  if (membershipError) {
    throw new AppError(500, "authorization_check_failed", "Unable to verify manager access.");
  }
  if (!profiles?.length) {
    throw new AppError(403, "manager_required", "Only event managers can use AI actions.");
  }

  return { server, requester: getRequesterClient(authorization), userId: userData.user.id };
}

function geminiEndpoint() {
  if (!GEMINI_API_KEY) {
    throw new AppError(503, "gemini_not_configured", "Gemini planning is not configured on this server.");
  }
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
}

async function generateGeminiContent(payload: JsonObject): Promise<{ text: string; usage: JsonObject }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(geminiEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new AppError(502, "gemini_error", "Gemini could not complete the request. Please try again.");
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string" || !text.trim()) {
      throw new AppError(502, "gemini_empty_response", "Gemini returned no usable response. Please try again.");
    }

    const usageMetadata = isRecord(data?.usageMetadata) ? data.usageMetadata : {};
    const usage: JsonObject = {};
    for (const key of ["promptTokenCount", "candidatesTokenCount", "totalTokenCount"]) {
      const value = usageMetadata[key];
      if (typeof value === "number" && Number.isFinite(value)) usage[key] = value;
    }
    return { text, usage };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AppError(504, "gemini_timeout", "Gemini timed out. No event was created.");
    }
    throw new AppError(502, "gemini_unavailable", "Gemini is temporarily unavailable. No event was created.");
  } finally {
    clearTimeout(timeout);
  }
}

async function planEvent(body: JsonObject, server: SupabaseClient, userId: string) {
  const prompt = requiredString(body.prompt, "prompt", 4_000);
  const result = await generateGeminiContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    systemInstruction: {
      parts: [{ text: "You create operational event blueprints. Return JSON only, matching the supplied schema. Create a new draft event; do not assign people to roles." }],
    },
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        required: ["title", "venue", "groups", "roleSlots", "programmes"],
        properties: {
          title: { type: "STRING" },
          venue: { type: "STRING" },
          groups: { type: "ARRAY", items: { type: "OBJECT", required: ["name"], properties: { name: { type: "STRING" }, description: { type: "STRING" }, icon: { type: "STRING" } } } },
          roleSlots: { type: "ARRAY", items: { type: "OBJECT", required: ["title", "responsibility"], properties: { title: { type: "STRING" }, responsibility: { type: "STRING" }, groupIndex: { type: "INTEGER", nullable: true } } } },
          programmes: { type: "ARRAY", items: { type: "OBJECT", required: ["title", "startTime"], properties: { title: { type: "STRING" }, description: { type: "STRING" }, startTime: { type: "STRING" }, endTime: { type: "STRING" }, venueOrStage: { type: "STRING" } } } },
        },
      },
    },
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.text);
  } catch {
    throw new AppError(502, "gemini_malformed_response", "Gemini returned an invalid event blueprint. No event was created.");
  }
  const blueprint = validateBlueprint(parsed);

  const { data, error } = await server
    .from("ai_event_blueprints")
    .insert({ manager_id: userId, prompt, blueprint, status: "draft" })
    .select("id, blueprint")
    .single();
  if (error || !data) {
    throw new AppError(500, "blueprint_persistence_failed", "The validated blueprint could not be saved. No event was created.");
  }

  return { blueprintId: data.id, blueprint: data.blueprint, usage: result.usage };
}

async function applyEventBlueprint(body: JsonObject, requester: SupabaseClient) {
  const blueprintId = requiredString(body.blueprintId, "blueprintId", 64);
  const blueprint = validateBlueprint({
    title: body.eventTitle,
    venue: body.venue,
    groups: body.groups,
    roleSlots: body.roleSlots,
    programmes: body.programmes,
  });

  const { data, error } = await requester
    .rpc("apply_ai_event_blueprint", {
      p_blueprint_id: blueprintId,
      p_event_title: blueprint.title,
      p_venue: blueprint.venue,
      p_groups: blueprint.groups,
      p_role_slots: blueprint.roleSlots,
      p_programmes: blueprint.programmes,
    })
    .single();
  if (error || !data) {
    if (error?.code === "22023" || error?.code === "42501") {
      throw new AppError(422, "blueprint_not_applicable", "This blueprint cannot be applied. It may already be applied or no longer be available.");
    }
    throw new AppError(500, "blueprint_apply_failed", "The event could not be created. No partial event was saved.");
  }

  return { event: data };
}

async function genericAction(action: string, body: JsonObject) {
  let systemInstruction: string;
  let userContent: string;

  if (action === "nl_to_task") {
    systemInstruction = "You are Sangam AI, an expert real-time event coordinator. Convert the instruction into JSON with title, department, priority (low|medium|high|critical), estimatedMinutes, and checklist. Respond only with valid JSON.";
    userContent = `Instruction: ${requiredString(body.prompt, "prompt", 4_000)}`;
  } else if (action === "risk_briefing") {
    systemInstruction = "You are Sangam AI, analyzing event tasks. Return JSON with overallStatus, summary, identifiedRisks, and recommendedActions. Respond only with valid JSON.";
    userContent = `Current Event Tasks: ${JSON.stringify(body.tasks || [])}\nEvent Info: ${JSON.stringify(body.eventInfo || {})}`;
  } else {
    systemInstruction = "You are Sangam AI, the intelligent event coordinator assisting event managers.";
    userContent = requiredString(body.prompt || "Provide an event status update.", "prompt", 4_000);
  }

  const result = await generateGeminiContent({
    contents: [{ role: "user", parts: [{ text: `${systemInstruction}\n\n${userContent}` }] }],
    generationConfig: { temperature: 0.2, responseMimeType: action === "chat" ? "text/plain" : "application/json" },
  });

  if (action === "chat") return new Response(result.text, { headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" } });
  try {
    return jsonResponse(JSON.parse(result.text));
  } catch {
    throw new AppError(502, "gemini_malformed_response", "Gemini returned invalid JSON. Please try again.");
  }
}

export async function handleRequest(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse(new AppError(405, "method_not_allowed", "Use POST for AI actions."));

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new AppError(400, "invalid_json", "Request body must be valid JSON.");
    }
    if (!isRecord(body) || typeof body.action !== "string") {
      throw new AppError(400, "invalid_request", "Request must include an AI action.");
    }

    const { server, requester, userId } = await requireManager(req);
    if (body.action === "plan_event") return jsonResponse(await planEvent(body, server, userId));
    if (body.action === "apply_event_blueprint") return jsonResponse(await applyEventBlueprint(body, requester));
    if (["chat", "nl_to_task", "risk_briefing"].includes(body.action)) return await genericAction(body.action, body);

    throw new AppError(400, "unsupported_action", "Unsupported AI action.");
  } catch (error) {
    if (error instanceof AppError) return errorResponse(error);
    return errorResponse(new AppError(500, "internal_error", "An unexpected error occurred. No event was created."));
  }
}

if (import.meta.main) serve(handleRequest);
