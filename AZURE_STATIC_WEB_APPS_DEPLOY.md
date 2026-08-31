# Deploying to Azure Static Web Apps

This is the simpler of the two Azure paths for this app (see also `AZURE_DEPLOY.md`
for App Service). Static Web Apps hosts the built frontend directly — there's no
server to run, since the app talks to Supabase straight from the browser. The
`server/index.js` Express server isn't used in this path at all; it's only
needed for App Service.

## 1. Create the Static Web App

**Via Azure Portal (easiest):**
1. Create a resource → **Static Web App**.
2. Plan: **Free** is enough for a single-location restaurant.
3. Deployment source: **GitHub** — sign in and pick your repo/branch.
4. Build details:
   - Build presets: **Custom**
   - App location: `/`
   - Output location: `dist`
5. Click Create. Azure automatically adds a GitHub Actions workflow to your repo
   with a deployment token already wired up as a secret
   (`AZURE_STATIC_WEB_APPS_API_TOKEN_...`).

If Azure added its own workflow file, you can **delete the one it generated**
and use `.github/workflows/azure-static-web-apps.yml` from this project instead
— it's set up to build with your Supabase keys baked in at build time (the
auto-generated one usually isn't). Just rename the token secret it created to
match what's expected below, or update the workflow file to reference whatever
name Azure gave it.

**Via Azure CLI**, if you'd rather not connect GitHub through the Portal:
```bash
az staticwebapp create \
  --name mupo-maharashtra-app \
  --resource-group mupo-maharashtra-rg \
  --location "centralus" \
  --sku Free
```
Then get the deployment token:
```bash
az staticwebapp secrets list \
  --name mupo-maharashtra-app \
  --query "properties.apiKey" -o tsv
```

## 2. Add repo secrets

In your GitHub repo → **Settings → Secrets and variables → Actions**, add:
- `AZURE_STATIC_WEB_APPS_API_TOKEN` → the deployment token from step 1
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 3. Push to deploy

Push to `main` (or open a pull request — Static Web Apps automatically creates
a preview environment for PRs, and tears it down when the PR closes). The
workflow builds the frontend with your Supabase keys baked in, then uploads it.

Your site will be live at the `https://<random-name>.azurestaticapps.net` URL
shown in the Portal (or attach a custom domain — Portal → your Static Web App →
Custom domains, free managed certificate included).

## 4. Verify

Open the site, place a test order at `/order`, then log in at `/staff` and
confirm it shows up, refresh `/staff` directly (not just navigate to it) to
confirm the SPA routing fallback (`staticwebapp.config.json`) is working.

## 5. Supabase side-effect to double check

Add your Static Web Apps URL to Supabase → Authentication → URL Configuration
as an allowed Site URL / Redirect URL, same as you would for any new domain.

## Static Web Apps vs. App Service — which one?

|  | Static Web Apps | App Service |
|---|---|---|
| Cost | Free tier available | ~$13/month minimum (B1) |
| Server needed | No | Yes (`server/index.js`) |
| Best for | This app, as-is | If you later add server-side logic (e.g. a custom API, webhooks, server-side validation) |

Since everything here runs client-side against Supabase, Static Web Apps is the
more natural fit and the one I'd default to unless you have a specific reason
to want a Node server in front of it.
