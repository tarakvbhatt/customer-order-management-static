# Deploying to Azure App Service

This app is a Node/Express server (`server/index.js`) that serves the built React
frontend, with Supabase (Postgres) as the database — nothing about the database
setup changes for Azure. This guide covers getting the Node server running on
an Azure App Service.

If you haven't done the Supabase setup yet, do that first — see the main
`README.md`.

## 1. Create the Azure App Service (one-time)

Requires the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
(`az login` first) or use the Azure Portal instead — the equivalent portal steps
are noted alongside each command.

```bash
# Pick names/region that make sense for you
RESOURCE_GROUP="mupo-maharashtra-rg"
APP_NAME="mupo-maharashtra-app"      # must be globally unique across Azure
LOCATION="centralindia"              # or e.g. westus, eastus

az group create --name $RESOURCE_GROUP --location $LOCATION

az appservice plan create \
  --name mupo-plan \
  --resource-group $RESOURCE_GROUP \
  --sku B1 \
  --is-linux

az webapp create \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --plan mupo-plan \
  --runtime "NODE:20-lts"
```
*(Portal equivalent: Create a resource → Web App → Publish: Code, Runtime stack:
Node 20 LTS, Operating System: Linux.)*

Your site's URL will be `https://<APP_NAME>.azurewebsites.net`.

## 2. Set required App Settings

```bash
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    VITE_SUPABASE_URL="https://your-project-ref.supabase.co" \
    VITE_SUPABASE_ANON_KEY="your-anon-public-key" \
    WEBSITES_PORT=8080
```

**Important nuance:** `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are baked into
the JavaScript bundle *at build time* by Vite — setting them as App Settings alone
only helps if the build happens on Azure itself. If you build in GitHub Actions
(recommended, see below), set them there as GitHub secrets instead; the App
Settings copies above are mainly a fallback for anyone who builds directly on Azure.

*(Portal equivalent: your App Service → Settings → Environment variables.)*

## 3. Deploy — pick one

### Option A: GitHub Actions (recommended, auto-deploys on every push)

1. Push this project to a GitHub repo.
2. In the Azure Portal, open your App Service → **Get publish profile**, download the file.
3. In your GitHub repo → **Settings → Secrets and variables → Actions**, add:
   - `AZURE_WEBAPP_PUBLISH_PROFILE` → paste the full contents of the downloaded file
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Edit `.github/workflows/azure-deploy.yml` and set `AZURE_WEBAPP_NAME` to your `$APP_NAME`.
5. Since the workflow builds everything itself, tell Azure not to rebuild on its end:
   ```bash
   az webapp config appsettings set \
     --name $APP_NAME --resource-group $RESOURCE_GROUP \
     --settings SCM_DO_BUILD_DURING_DEPLOYMENT=false
   ```
6. Push to `main`. The workflow builds the frontend with your Supabase keys baked in, then deploys the server + built assets to Azure.

### Option B: Manual deploy from your machine

```bash
npm install
npm run build          # produces dist/ using your local .env values

# Zip everything the server needs to run
zip -r deploy.zip dist server package.json package-lock.json node_modules \
  -x "node_modules/.cache/*"

az webapp deploy \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --src-path deploy.zip \
  --type zip
```

Re-run this any time you change the frontend or the database schema's menu items.

## 4. Verify

```bash
curl https://$APP_NAME.azurewebsites.net/healthz   # should return "ok"
```

Then open `https://<APP_NAME>.azurewebsites.net` in a browser — you should see
the home page, `/order` should place orders into Supabase, and `/staff` should
let you log in and see them.

## 5. Supabase side-effects to double check

- **Auth redirect URLs**: in your Supabase project → Authentication → URL
  Configuration, add `https://<APP_NAME>.azurewebsites.net` as an allowed Site
  URL / Redirect URL so staff login works from the deployed domain.
- Nothing else changes — RLS policies, the `place_order` function, and table
  structure are identical to local development, since the browser talks to
  Supabase directly regardless of where the frontend is hosted.

## Notes

- **Custom domain / HTTPS**: Azure App Service supports free managed
  certificates for custom domains — Portal → your App Service → Custom domains.
- **Scaling**: the B1 plan above is fine for a single restaurant's traffic;
  bump the SKU in the Portal (or `az appservice plan update`) if needed later.
- **Logs**: `az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP`
  streams live server logs if something isn't loading.
