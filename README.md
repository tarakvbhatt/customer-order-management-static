# मु.पो.महाराष्ट्र — Ordering & Counter App

A full-stack web app for मु.पो.महाराष्ट्र with three parts:

- **`/`** — landing page
- **`/order`** — public ordering form for customers (writes to the database)
- **`/staff`** — login-gated staff dashboard: live orders, customer profiles, preferences, and analytics

**Frontend**: React + Vite. **Server**: a small Node/Express server (`server/index.js`) that serves the built frontend — this is what runs on Azure App Service. **Database**: Supabase (Postgres). The browser talks to Supabase directly (via Supabase's client library, protected by Row Level Security), so the Express server's only job is hosting the built app — it doesn't proxy database calls.

## 1. Set up the database

**New setup:** create a free project at [supabase.com](https://supabase.com), open **SQL Editor → New query**, paste in the contents of `supabase/schema.sql`, and run it.

**Already running this app?** Don't re-run `schema.sql` — it'll fail on tables/policies that already exist. Instead run **`supabase/migrations/002_add_menu_items.sql`**, which just adds the new product-catalog table and leaves everything else untouched.

Either way, this sets up:
- `customers`, `orders`, `order_items` — the core tables, with RLS so the public order form can only create orders, never read anyone else's data
- `menu_items` — the admin-managed product catalog (name, category, price, availability, image) that both the order form and the staff dashboard's **Products** tab read from
- a public `menu-images` storage bucket for product photos

Then:
1. Go to **Authentication → Users → Add user** and create a login (email + password) for yourself and each staff member. There's no public sign-up page by design.
2. Go to **Project Settings → API** and copy the **Project URL** and **anon public key**.

## 2. Configure the app

```bash
cp .env.example .env
```

Open `.env` and paste in your Project URL and anon key:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

## 3. Run it locally

**Frontend dev server** (hot reload, for building/tweaking UI):
```bash
npm install
npm run dev
```
Open `http://localhost:5173`.

**Or run it the way it runs in production** (build + Express server):
```bash
npm install
npm run build
npm start
```
Open `http://localhost:8080`.

Try placing a test order at `/order`, then log in at `/staff` to see it appear.

## 4. Deploy to Azure

Two options, depending on how you want to host it:

- **[`AZURE_STATIC_WEB_APPS_DEPLOY.md`](./AZURE_STATIC_WEB_APPS_DEPLOY.md)** — recommended. Free tier, no server to manage, since this app talks to Supabase directly from the browser.
- **[`AZURE_DEPLOY.md`](./AZURE_DEPLOY.md)** — Azure App Service with the included Express server (`server/index.js`). Use this if you want a Node server in front of the app for future server-side logic.

## Project structure

```
mupo-app/
├── supabase/schema.sql        ← run once in Supabase
├── server/index.js            ← Express server (serves the built frontend on Azure)
├── .github/workflows/
│   └── azure-deploy.yml       ← CI/CD: build + deploy to Azure App Service
├── AZURE_DEPLOY.md            ← Azure deployment guide
├── src/
│   ├── lib/
│   │   ├── supabaseClient.js  ← database connection
│   │   └── menu.js            ← menu items & prices (edit here to update the menu)
│   ├── components/
│   │   ├── Home.jsx
│   │   ├── OrderForm.jsx      ← public ordering page
│   │   ├── StaffDashboard.jsx ← login-gated dashboard
│   │   └── AnalyticsPanel.jsx ← charts & visuals
│   ├── App.jsx                ← routing
│   └── index.css              ← all styling
```

## Notes

- **Updating the menu or prices**: edit `src/lib/menu.js` — both the order form and dashboard read from the same file.
- **Costs**: Supabase's free tier easily covers a single-location restaurant (500MB database, 50,000 monthly auth users). Azure App Service B1 tier is a reasonable starting point (~$13/month) — see `AZURE_DEPLOY.md` for scaling notes.
- **Adding staff**: add them in Supabase → Authentication → Users. No code changes needed.

