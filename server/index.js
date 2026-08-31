// Minimal Node/Express server for Azure App Service.
// Serves the built React app (src/ -> dist/) and falls back to
// index.html for any non-file route so client-side routing works.
//
// The app itself still talks to Supabase directly from the browser
// (see src/lib/supabaseClient.js) — this server does not proxy or
// store any data, it just hosts the static build.

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "..", "dist");

const app = express();

// Azure App Service sets PORT; default to 8080 for local testing.
const PORT = process.env.PORT || 8080;

// Basic health check — useful for Azure's "Health check" App Service setting.
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

app.use(express.static(distDir));

// SPA fallback: any route that isn't a static file goes to index.html
// so /order, /staff, etc. work on direct load and page refresh.
app.get("*", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`मु.पो.महाराष्ट्र server listening on port ${PORT}`);
});
