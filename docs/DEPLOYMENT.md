# Deployment — Vercel Hobby (website) + Render Free (EDAgent API)

Two independent parts. The website is static and works on its own. The API is needed only for the EDAgent tab.
If the API is asleep or missing, the EDAgent tab shows "Connecting… (can take up to a minute if it was asleep)",
then an "unreachable / may be starting up" message with **Try again**. All research pages are unaffected.

**Initial deployment is AI-free.** The Render blueprint sets no provider key (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`), and `ALLOW_BYOK=false`.
The chat tab therefore says "Chat is optional and not configured on this server". Nothing incurs AI cost.

## Deployment source: use a personal GitHub repository

Vercel's documentation is inconsistent about organization repositories on Hobby. The Hobby plan page
([vercel.com/docs/plans/hobby](https://vercel.com/docs/plans/hobby), checked 2026-11-20) says Hobby
projects **cannot connect to Git repositories owned by a GitHub organization**. Other parts of the Git
integration docs describe importing repositories from any GitHub account you connect. Do not rely on the
organization repo (`ExploratoryDataAnalysis/CrashCross`) for a Git-connected Hobby project. Instead:

1. Create a repository under your **personal** GitHub account (e.g. `<you>/CrashCross`).
2. Push this repository to it: `git remote add personal https://github.com/<you>/CrashCross.git` then `git push personal main`.
3. Connect both Vercel and Render to that personal repo.

Visibility is your choice. Vercel and Render can both read private repos once their GitHub app has access.
`web/public/data` contains only the publishable bundle (see DATA_MAPPING).

## What was checked (2026-11-20)

| Check | Result |
| --- | --- |
| `web/` builds from a fresh clone without `analysis/` (the export is git-ignored) | ✅ `npm ci && npm run build` succeeds; `web/public/data` is committed |
| SPA routing | `web/vercel.json` rewrites every path except `/data/*` and `/assets/*` to `/index.html`; missing data files return 404, never HTML. The loader also rejects HTML responses |
| Render install | ✅ fresh Python 3.13.7 venv: `pip install --no-cache-dir -r requirements.txt` (pinned: fastapi 0.115.6, pandas 2.2.3, numpy 2.2.1, anthropic 2.11.0, …) |
| Python version | `PYTHON_VERSION=3.13.7` in the blueprint and `api/.python-version` |
| Start command | ✅ `uvicorn … --workers 1` started and served `/api/health`; one worker is required because sessions are in process memory |
| Health endpoint | `/api/health` → `{"status":"ok", "ai": {"server_configured": false, …}, "limits": {…}}` |
| CORS | ✅ only `ALLOWED_ORIGINS` (plus optional `ALLOWED_ORIGIN_REGEX`) receive `Access-Control-Allow-Origin`; other origins get none |
| Memory vs 512 MB | Measured on a 10 MB CSV: a 37–55 MB DataFrame; idle process ≈ 70–100 MB; parsing transiently needs ≈ 2× the frame. Safeguards: uploads parsed one at a time, total retained data capped by `SESSION_MEMORY_BUDGET_MB=240` (least-recently-used sessions evicted; a single oversized dataset gets HTTP 413 with a message), `MAX_SESSIONS=8`. Worst case ≈ 100 + 240 + ~110 MB ≈ 450 MB |
| Cold start / expiry messages | Health check timeout 95 s with a waking message; expired sessions show "Your previous session has expired… upload the file again" |

## Render Free — dashboard settings

New → **Blueprint** → select your personal repo (uses `render.yaml`). Or New → **Web Service** with:

| Field | Value |
| --- | --- |
| Repository / Branch | `<you>/CrashCross` · `main` |
| Root Directory | `api` |
| Runtime / Language | Python 3 |
| Build Command | `pip install --no-cache-dir -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1 --proxy-headers --forwarded-allow-ips="*"` |
| Instance Type | Free |
| Health Check Path | `/api/health` |
| Auto-Deploy | On commit (optional) |

Environment variables:

| Key | Value |
| --- | --- |
| `PYTHON_VERSION` | `3.13.7` |
| `ENVIRONMENT` | `production` |
| `ALLOWED_ORIGINS` | your Vercel production URL, e.g. `https://crashcross.vercel.app` (no trailing slash; comma-separate several) |
| `ALLOWED_ORIGIN_REGEX` | *(optional, for preview deploys)* `^https://crashcross-[a-z0-9-]+-<your-vercel-scope>\.vercel\.app$` |
| `ALLOW_BYOK` | `false` |
| `MAX_UPLOAD_MB` | `10` |
| `MAX_SESSIONS` | `8` |
| `SESSION_MEMORY_BUDGET_MB` | `240` |
| `SESSION_TTL_MINUTES` | `60` |
| `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `XAI_API_KEY` | **leave unset** (chat disabled). Add one or more later as secrets to enable chat for that provider; this incurs API costs |

Afterwards open `https://<service>.onrender.com/api/health`.

### Enable or change AI keys on a live deployment

In Render, select the **EDAgent API service → Environment → Add Environment Variable**. Add
`GEMINI_API_KEY` for Gemini, `XAI_API_KEY` for Grok, and/or `ANTHROPIC_API_KEY` for Anthropic.
Keep actual key values out of Git, `render.yaml` and Vercel's frontend variables. Key configuration is
independent of commits: deploy the provider-support code, set the key in Render, then **Save and deploy**.
To rotate a key later, edit that variable and select **Save and deploy** again; no code commit is needed.
The restarted backend clears in-memory upload sessions, so re-upload the dataset if necessary.
The Rows tab's full-table search does not need an AI key and remains available without provider quota.

The checked-in blueprint enables auto-deploy (`autoDeploy: true`). Confirm the actual service's linked
branch and **Auto-Deploy: On Commit** setting in Render; pushing backend changes under `api/` triggers
its rebuild. Vercel deploys the website separately. A local commit alone is not a deployment, and neither
host's live deployment success is established by passing local tests. See
[Render environment settings](https://render.com/docs/configure-environment-variables) and
[Render deploys](https://render.com/docs/deploys).

Render Free limits ([docs](https://render.com/docs/free), checked 2026-11-20): 0.1 CPU and 512 MB RAM. The
service sleeps after 15 minutes idle and takes about a minute to wake. There are 750 instance-hours per
month, the filesystem is ephemeral, and Render may restart the service at any time. Render says not to use
it for production. Any sleep, restart or redeploy deletes all EDAgent sessions; the UI explains this.

## Vercel Hobby — dashboard settings

Add New → Project → Import `<you>/CrashCross`:

| Field | Value |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | `web` |
| Install Command | `npm ci` (also in `web/vercel.json`) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js Version (Settings → Build & Deployment) | 22.x (`web/.nvmrc`) |
| Environment Variable | `VITE_EDAGENT_API_URL` = `https://<service>.onrender.com` (Production, and Preview if you set the regex above) |

`VITE_EDAGENT_API_URL` is read at build time, so redeploy after changing it. Hobby limits (checked
2026-11-20): 100 GB transfer and 1 M CDN requests per month, 45-minute builds. Going over a limit pauses
the feature rather than billing. Commercial-use terms are in Vercel's Terms of Service and were not
reviewed here.

## Order of steps

1. Push to your personal repo.
2. Deploy Render with `ALLOWED_ORIGINS` set to a placeholder, and note the service URL.
3. Deploy Vercel with `VITE_EDAGENT_API_URL` set to that URL, and note the site URL.
4. Set Render `ALLOWED_ORIGINS` to the site URL and save. The service restarts.
5. Smoke test:
   - `/`, `/visualization#figure-3-7`, `/report?page=17`, `/resources`, and a direct reload of `/appendices` (SPA routing)
   - `/data/does-not-exist.csv` returns 404
   - EDAgent: upload a small CSV, create a chart, download the HTML report
   - The chat tab shows "not configured"

## Alternatives

- **Static site:** Cloudflare Pages, Netlify or Render Static Site serve `web/dist` (add an SPA fallback).
- **API:** a paid Render instance (no sleep), Fly.io, Railway, or Cloud Run with max instances = 1.
  Always run one worker.
