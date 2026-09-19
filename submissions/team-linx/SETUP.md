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

## 1. Create Supabase project + run schema

1. Go to https://supabase.com → **New Project** → note DB password.
2. Wait for provisioning (~2 min).
3. Open **SQL Editor → New Query** → paste entire contents of
   `submissions/team-linx/app/supabase/schema.sql` → **Run**.
4. Verify: **Table Editor** should show `profiles, events, departments,
   event_members, tasks, chat_messages, ai_briefings`.
5. Enable Realtime (schema already does `alter publication supabase_realtime add table`
   for `tasks` and `chat_messages`, but confirm):
   **Database → Replication → supabase_realtime →** check `tasks`, `chat_messages`.

### Seed one demo event (run in SQL Editor)

```sql
insert into public.events (title, tagline, venue, start_date, end_date, status)
values ('Kraft Night 2026', 'Unified Event Command Center', 'Main Auditorium', now(), now() + interval '1 day', 'live')
returning id;
-- copy the returned id as EVENT_ID, then:
insert into public.departments (event_id, name, icon)
values
 ('<EVENT_ID>', 'Stage & Sound', '🎤'),
 ('<EVENT_ID>', 'Logistics & Transport', '📦'),
 ('<EVENT_ID>', 'Hospitality & VIPs', '☕'),
 ('<EVENT_ID>', 'Tech & Streaming', '💻'),
 ('<EVENT_ID>', 'Media & PR', '📸');
```

---

## 2. Connect frontend to Supabase (2-minute version, no rebuild)

Option A — `env.js` file (recommended for local dev):

```powershell
cd submissions\team-linx\app
copy env.example.js env.js
# then edit env.js with your URL + anon key + set true
```

```js
window.ENV_SUPABASE_URL = "https://xyzcompany.supabase.co";
window.ENV_SUPABASE_ANON_KEY = "eyJhbGciOi...your-anon-key";
window.ENV_USE_LIVE_BACKEND = true;
```

`index.html` already loads `env.js` before `js/main.js`, and `js/config.js`
reads it automatically.

Option B — no file, via browser console (good for quick judge demo):

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

Checklist: reload app → open DevTools console → no 404 for `env.js` (or
expected info log) → `ai.js`/`email.js` will now `fetch(.../functions/v1/...)`
instead of mock fallback.

---

## 3. Get Gemini API key

1. Go to https://aistudio.google.com → **Get API Key** → **Create API key**.
2. Copy key starting with `AIza...`.
3. Restrict it (optional but recommended): Google Cloud Console → Credentials → HTTP referrer / API restriction to Generative Language API.
4. Model used in `supabase/functions/ai-coordinator/index.ts`:
   `gemini-1.5-flash:generateContent`. No further setup needed — the Edge Function
   already builds the correct `generateContent` payload.

Test directly (PowerShell):

```powershell
$key="AIzaYOURKEY"
Invoke-RestMethod -Method Post -ContentType "application/json" `
 -Uri "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$key" `
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
supabase secrets set SENDGRID_API_KEY="SG.xxxxx"
supabase secrets set SENDGRID_SENDER_EMAIL="organizer@yourdomain.com"
supabase secrets list
```

Deploy:

```powershell
supabase functions deploy ai-coordinator
supabase functions deploy send-email
```

Test live endpoints:

```powershell
$anon="eyJhbGciOi...anon-key"
$base="https://xyzcompany.supabase.co/functions/v1"

Invoke-RestMethod -Method Post -ContentType "application/json" `
 -Headers @{apikey=$anon; Authorization="Bearer $anon"} `
 -Uri "$base/ai-coordinator" `
 -Body '{"action":"nl_to_task","prompt":"Arrange 4 cordless mics for Stage 1 by 4 PM"}'

Invoke-RestMethod -Method Post -ContentType "application/json" `
 -Headers @{apikey=$anon; Authorization="Bearer $anon"} `
 -Uri "$base/send-email" `
 -Body '{"toEmail":"test@example.com","recipientName":"Test","type":"invitation","details":{"eventName":"Kraft Night 2026","role":"volunteer","department":"Stage & Sound","inviteUrl":"http://localhost:8000"}}'
```

If Gemini returns JSON and SendGrid returns `{success:true}`, flip frontend to
live (`env.js` → `true`) and reload.

---

## 6. What YOU still need to do (your action list)

- [ ] Create Supabase project, run `schema.sql`, seed one event + 5 departments
- [ ] Copy `app/env.example.js` → `app/env.js`, fill URL + anon key
- [ ] Get Gemini key from AI Studio, set as Edge Function secret, deploy `ai-coordinator`
- [ ] Get SendGrid key + verify sender email, set secrets, deploy `send-email`
- [ ] Set `window.ENV_USE_LIVE_BACKEND = true` (or localStorage flag) and reload
- [ ] (Next dev step) Replace `localStorage` task/chat stores in `js/tasks.js` /
        `js/chat.js` with real Supabase queries + Realtime subscriptions via
        `js/supabase-client.js` (`getSupabase()` helper already added).
        `js/ai.js` and `js/email.js` already call the Edge Functions when live.
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
