// ==============================================================================
// SANGAM - Supabase Edge Function: ai-coordinator
// Purpose: Proxies Google Gemini AI API to prevent API key exposure in browser
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, prompt, tasks, eventInfo } = await req.json();

    let systemInstruction = "";
    let userContent = "";

    if (action === "nl_to_task") {
      systemInstruction = `You are Sangam AI, an expert real-time event coordinator. 
Convert natural-language event instructions into structured JSON tasks with fields:
- title: string
- department: string (choose best fit from: 'Stage & Sound', 'Logistics', 'Hospitality', 'Tech', 'Media/PR')
- priority: 'low' | 'medium' | 'high' | 'critical'
- estimatedMinutes: number
- checklist: array of short action items
Respond ONLY with valid JSON.`;
      userContent = `Instruction: "${prompt}"`;
    } else if (action === "risk_briefing") {
      systemInstruction = `You are Sangam AI, analyzing live event tasks to identify delays, bottlenecks, and risks.
Provide a structured JSON output with:
- overallStatus: 'Smooth' | 'Needs Attention' | 'Critical Risk'
- summary: short 2-sentence executive summary
- identifiedRisks: array of strings describing bottlenecks
- recommendedActions: array of immediate 2-hour priority steps
Respond ONLY with valid JSON.`;
      userContent = `Current Event Tasks: ${JSON.stringify(tasks || [])}\nEvent Info: ${JSON.stringify(eventInfo || {})}`;
    } else {
      systemInstruction = "You are Sangam AI, the intelligent event coordinator assisting organizers, department leads, and volunteers.";
      userContent = prompt || "Provide an event status update.";
    }

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemInstruction}\n\n${userContent}` }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: action === "chat" ? "text/plain" : "application/json"
      }
    };

    const response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    return new Response(generatedText, {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
