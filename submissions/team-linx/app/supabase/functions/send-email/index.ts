// ==============================================================================
// SANGAM - Supabase Edge Function: send-email
// Purpose: Proxies SendGrid v3 API for invitations & critical delay escalations
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") || "";
const SENDGRID_SENDER_EMAIL = Deno.env.get("SENDGRID_SENDER_EMAIL") || "no-reply@sangam.in";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { toEmail, recipientName, type, details } = await req.json();

    let subject = "Update from Sangam Event Command Center";
    let htmlContent = "";

    if (type === "invitation") {
      subject = `[Sangam] You're invited to join ${details.eventName || "Kraft Night 2026"}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #6366f1;">Welcome to Sangam (സംഗമം)</h2>
          <p>Hello <strong>${recipientName || "Team Member"}</strong>,</p>
          <p>You have been assigned as a <strong>${details.role?.toUpperCase()}</strong> in the <strong>${details.department}</strong> department for <strong>${details.eventName}</strong>.</p>
          <p style="margin-top: 20px;">
            <a href="${details.inviteUrl || "https://sangam.in/join"}" style="background: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Accept & Enter Command Center
            </a>
          </p>
        </div>
      `;
    } else if (type === "risk_escalation") {
      subject = `⚠️ [Urgent Alert] Task Overdue in ${details.department}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #ef4444;">Task Overdue Escalation</h2>
          <p><strong>Task:</strong> ${details.taskTitle}</p>
          <p><strong>Department:</strong> ${details.department}</p>
          <p><strong>Severity:</strong> <span style="color: #ef4444; font-weight: bold;">CRITICAL</span></p>
          <p>Sangam AI has flagged this task as a potential event bottleneck. Please check in with the on-ground lead immediately.</p>
        </div>
      `;
    }

    const payload = {
      personalizations: [
        {
          to: [{ email: toEmail, name: recipientName || "Team Member" }]
        }
      ],
      from: { email: SENDGRID_SENDER_EMAIL, name: "Sangam Command Center" },
      subject: subject,
      content: [{ type: "text/html", value: htmlContent }]
    };

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errBody = await response.text();
      return new Response(JSON.stringify({ error: errBody }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: true, message: "Email dispatched successfully via SendGrid" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
