// ==============================================================================
// SANGAM - Supabase Automated Schema Deployment Script
// Team LINX • Kraft Night 2026
// ==============================================================================
// Usage:
//   node apply-schema.js
// ==============================================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../env.js");
const schemaPath = path.resolve(__dirname, "schema.sql");

async function main() {
  console.log("🚀 Checking credentials for Supabase schema execution...");

  let token = process.env.SUPABASE_ACCESS_TOKEN;
  let projectRef = "jjbjwpogfpqishghayje";

  // Check env.js if token is not in environment
  if (!token && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const tokenMatch = envContent.match(/ENV_SUPABASE_PAT\s*=\s*["']([^"']+)["']/);
    if (tokenMatch && tokenMatch[1] && tokenMatch[1].startsWith("sbp_")) {
      token = tokenMatch[1].trim();
    }
  }

  if (!token) {
    console.error("❌ Error: Supabase Personal Access Token (sbp_...) not found!");
    console.log("👉 Please add your token to `app/env.js` as:");
    console.log('   window.ENV_SUPABASE_PAT = "sbp_your_token_here";');
    process.exit(1);
  }

  if (!fs.existsSync(schemaPath)) {
    console.error(`❌ Error: schema.sql not found at ${schemaPath}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(schemaPath, "utf-8");
  console.log(`📄 Read schema.sql (${sqlContent.length} bytes). Deploying to project: ${projectRef}...`);

  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: sqlContent })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ Supabase API error (${res.status}):`, errorText);
      process.exit(1);
    }

    const data = await res.json().catch(() => ({}));
    console.log("✅ Success! Database schema and Realtime publication executed successfully in Supabase.");
    console.log("🎉 All tables (events, event_groups, event_members, programmes, chat_messages, ai_chat_sessions) are now live!");
  } catch (err) {
    console.error("❌ Network or execution error:", err.message);
    process.exit(1);
  }
}

main();
