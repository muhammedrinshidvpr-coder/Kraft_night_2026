# Sangam — Supabase + Gemini + SendGrid Setup Guide
Team LINX • Kraft Night 2026

Your app currently runs in **MOCK mode** (`USE_LIVE_BACKEND = false`) using
`localStorage` + heuristic fallbacks in `js/ai.js` and `js/email.js`.
Follow these steps once to go live.

---

## 0. What you need to get (checklist)

| # | What | Where to get it | Used for |
|---|------|-----------------|----------|
| 1 | Supabase Project URL (`https://xyzcompany.supabase.co`) | supabase.com → New Project | DB + Auth + Realtime |
| 2 | Supabase `anon` public key | Supabase Dashboard → Project Settings → API | Frontend `js/config.js` + Edge Function `apikey` header |
| 3 | Supabase `service_role` key (server only, never in frontend) | Same page as above | Only if you need admin scripts |
| 4 | Gemini API key (`AIza...`) | Google AI Studio → Get API Key | Edge Function secret `GEMINI_API_KEY` |
| 5 | SendGrid API key (`SG.xxx`) | SendGrid → Settings → API Keys → Create (Full Access → Mail Send) | Edge Function secret `SENDGRID_API_KEY` |
| 6 | Verified SendGrid sender email | SendGrid → Settings → Sender Authentication (single sender or domain) | Edge Function secret `SENDGRID_SENDER_EMAIL` |

> Keep `service_role`, `GEMINI_API_KEY`, and `SENDGRID_API_KEY` **only in
> Supabase Edge Function secrets** — never paste them into `env.js` or frontend code.

---

## 1. Create Supabase project + run the deployed schema

1. Go to https://supabase.com → **New Project** → note DB password.
2. Wait for provisioning (~2 min).
3. Open the SQL Editor and run `app/supabase/schema.sql`.
4. Then run `app/supabase/migrations/09_ai_event_blueprints.sql` and
   `10_auth_profile_trigger.sql`.
5. Verify: **Table Editor** shows `profiles, events, event_groups,
   event_members, programmes, chat_messages, ai_event_blueprints`, and
   `event_role_slots`.
6. Enable Realtime for `programmes`, `event_members`, and `chat_messages` if
   the migration did not already add them to `supabase_realtime`.

### Provision the first manager (run after they sign up)

Promote the new authenticated user before asking Gemini to create their first
event. The profile ID is stored as text in this deployed schema:

```sql
update public.profiles
set role = 'manager', department = 'Event Organizer'
where email = 'manager@example.com';
```

---

## 2. Connect frontend to Supabase (2-minute version, no rebuild)

`index.html` intentionally does not load `env.js`. Browser configuration must
contain only public Supabase connection values. Do not add Gemini, service-role,
deployment, or email-provider secrets to browser configuration.

For a local browser demo, configure the public values through the browser console:

```js
localStorage.setItem("sangam_supabase_url", "https://xyz.supabase.co");
localStorage.setItem("sangam_supabase_anon_key", "eyJhbGciOi...");
localStorage.setItem("sangam_use_live", "true");
location.reload();
```

Helpers also exist in code:

```js
import { enableLiveBackend } from "./js/config.js";
enableLiveBackend("https://xyz.supabase.co", "eyJhbGciOi...");
```

Checklist: reload app → open DevTools console → live client connects → public
Supabase calls work. Gemini is never called from the browser; managers call
the `ai-coordinator` Edge Function with an authenticated Supabase session.

---

## 3. Get Gemini API key

1. Go to https://aistudio.google.com → **Get API Key** → **Create API key**.
2. Copy key starting with `AIza...`.
3. Restrict it to the Generative Language API. Do not use an HTTP-referrer
   restriction because the key is used server-to-server by the Edge Function.
4. The Edge Function reads `GEMINI_MODEL` (default: `gemini-2.5-flash`). Set a
   supported Flash model explicitly when deploying so model upgrades do not
   require browser changes.

Test directly (PowerShell):

```powershell
$key="AIzaYOURKEY"
Invoke-RestMethod -Method Post -ContentType "application/json" `
  -Uri "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$key" `
 -Body '{"contents":[{"parts":[{"text":"Say OK"}]}]}'
```

---

## 4. Get SendGrid API key + sender

1. https://sendgrid.com → **Settings → API Keys → Create API Key** → Full Access (or at minimum **Mail Send**).
2. Copy `SG.xxxxx` — shown only once.
3. **Settings → Sender Authentication** → verify either a **Single Sender**
   (e.g. `organizer@yourdomain.com`, click verification email) or **Domain**.
   Free tier requires this or SendGrid returns 403.
4. That verified email becomes `SENDGRID_SENDER_EMAIL` (default in code is
   `no-reply@sangam.in` — you must change it to your verified sender).

---

## 5. Deploy Edge Functions + set secrets

Install Supabase CLI once:

```powershell
npm i -g supabase
supabase login
supabase link --project-ref xyzcompany  # xyzcompany = part before .supabase.co
```

Set secrets (these live server-side only):

```powershell
supabase secrets set GEMINI_API_KEY="AIzaYOURKEY"
supabase secrets set GEMINI_MODEL="gemini-2.5-flash"
supabase secrets set SENDGRID_API_KEY="SG.xxxxx"
supabase secrets set SENDGRID_SENDER_EMAIL="organizer@yourdomain.com"
supabase secrets list
```

Deploy:

```powershell
supabase functions deploy ai-coordinator
supabase functions deploy send-email
```

Test the manager-only planning endpoint with a real authenticated manager access
token, not the public anonymous token:

```powershell
$anon="eyJhbGciOi...anon-key"
$managerAccessToken="eyJhbGciOi...authenticated-manager-session"
$base="https://xyzcompany.supabase.co/functions/v1"

Invoke-RestMethod -Method Post -ContentType "application/json" `
  -Headers @{apikey=$anon; Authorization="Bearer $managerAccessToken"} `
  -Uri "$base/ai-coordinator" `
  -Body '{"action":"plan_event","prompt":"Create a marriage event with appropriate groups and unfilled role slots"}'

Invoke-RestMethod -Method Post -ContentType "application/json" `
 -Headers @{apikey=$anon; Authorization="Bearer $anon"} `
 -Uri "$base/send-email" `
 -Body '{"toEmail":"test@example.com","recipientName":"Test","type":"invitation","details":{"eventName":"Kraft Night 2026","role":"volunteer","department":"Stage & Sound","inviteUrl":"http://localhost:8000"}}'
```

Apply `supabase/migrations/09_ai_event_blueprints.sql`,
`10_auth_profile_trigger.sql`, and `11_programme_sync_security.sql` after the
base `schema.sql` before using AI event creation or the shared schedule.
Migration `11` replaces the public `programmes` write policy with
manager-of-that-event RLS, adds the transactional
`replace_event_programmes` RPC, and requires `programmes` in the
`supabase_realtime` publication. Deploy the migration before the frontend.
A Gemini event plan is only available to a
manager with a real Supabase Auth session. The existing local persona switcher
is an offline UI demo and cannot authorize a production Gemini request.

When Gemini is configured, factual manager questions such as teams, roles,
programmes, and schedule remain local and carry a `Live event data` badge.
Planning requests create a Gemini draft preview and require confirmation before
the Edge Function creates a separate draft event, groups, and unfilled roles.

---

## 6. What YOU still need to do (your action list)

- [ ] Create Supabase project, run `schema.sql`, then run migrations `09`, `10`, and `11_programme_sync_security.sql` (verify `programmes` is in `supabase_realtime`)
- [ ] Back up the manager's reviewed programme schedule, deploy migration `11` before the frontend, then have the manager open the affected event and publish the reviewed schedule once via the workspace sync notice (members reload/rejoin afterwards)
- [ ] Configure public Supabase URL + anonymous key through browser-local development settings only
- [ ] Get Gemini key from AI Studio, set as Edge Function secret, deploy `ai-coordinator`
- [ ] Set `GEMINI_MODEL`, run migration `09_ai_event_blueprints.sql`, and sign in through Supabase Auth as an event manager
- [ ] Revoke and rotate any deployment, service-role, or provider credential ever placed in a browser-local file
- [ ] Get SendGrid key + verify sender email, set secrets, deploy `send-email`
- [ ] Set `window.ENV_USE_LIVE_BACKEND = true` (or localStorage flag) and reload
- [ ] (Next dev step) Replace `localStorage` task/chat stores in `js/tasks.js` /
        `js/chat.js` with real Supabase queries + Realtime subscriptions via
        `js/supabase-client.js` (`getSupabase()` helper already added).
        `js/ai.js` calls the authenticated AI Edge Function for Gemini only;
        factual AI responses remain local.
- [ ] Add RLS `insert/update/delete` policies for judges' anon role if writes fail
        (current schema allows public read + open task/chat insert/update — tighten
        before production).

---

## 7. How to run the app

```powershell
# static, no build step
npx serve submissions/team-linx/app/
# open http://localhost:3000, toggle Admin / Lead / Volunteer in top bar
```

Mock mode works with zero keys — live mode needs steps 1–5 done.
