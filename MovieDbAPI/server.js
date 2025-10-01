// server.js — TMDB v3 (api_key) version
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const TMDB_V3_KEY = process.env.TMDB_V3_KEY || ""; // <-- set this in .env

// Boot logs
console.log(`[boot] cwd=${process.cwd()}`);
console.log("[boot] TMDB v3 key loaded:", TMDB_V3_KEY ? "yes" : "NO");
if (!TMDB_V3_KEY) {
  console.warn("[WARN] Missing TMDB_V3_KEY in .env");
}

app.use(cors());
app.use(express.json());
app.use(express.static("public")); // serves public/index.html if present

// ---------- Helpers ----------
function buildTmdbUrl(path, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  url.searchParams.set("api_key", TMDB_V3_KEY);
  return url;
}

const IMG_BASE = "https://image.tmdb.org/t/p";
const IMG_SIZE = "w342"; // change to w185/w500/original if you want

function posterUrl(path) {
  return path ? `${IMG_BASE}/${IMG_SIZE}${path}` : null;
}

function normalizeMovie(r) {
  return {
    id: r.id,
    title: r.title || r.original_title || "",
    year: (r.release_date || "").slice(0, 4),
    overview: r.overview || "",
    posterUrl: posterUrl(r.poster_path),
    // rating: r.vote_average ?? null,  taken from themoviedatabase, 
    // popularity: r.popularity ?? null, but we want to run on our own ratings
    release_date: r.release_date || null,
  };
}
// ---------- End helpers ----------

// Health check
app.get("/healthz", (req, res) => {
  res.json({
    ok: true,
    auth: { v3: !!TMDB_V3_KEY },
    routes: ["/api/search/movie", "/api/search/movie/simple", "/api/title/movie/:id"],
  });
});

/**
 * GET /api/search/movie?q=Inception&page=1
 * Proxies to TMDB /3/search/movie (v3 api_key in query) — RAW TMDB payload
 */
app.get("/api/search/movie", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const page = String(req.query.page || 1);
    if (!q) return res.status(400).json({ error: "missing q" });
    if (!TMDB_V3_KEY) return res.status(500).json({ error: "server", detail: "TMDB_V3_KEY not set" });

    const url = buildTmdbUrl("/search/movie", {
      query: q,
      include_adult: "false",
      language: "en-US",
      page,
    });

    console.log(`[req] /api/search/movie q="${q}" page=${page}`);
    const r = await fetch(url.toString(), {
      headers: { "Content-Type": "application/json;charset=utf-8" },
      timeout: 15000,
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error(`[err] TMDB ${r.status}`, body);
      return res.status(502).json({ error: "upstream", status: r.status, detail: body });
    }
    res.json(body);
  } catch (e) {
    console.error("[err] server", e);
    res.status(500).json({ error: "server", detail: String(e) });
  }
});

/**
 * GET /api/search/movie/simple?q=Inception&page=1&pretty=1&save=1
 * Same search, but returns trimmed, UI-friendly JSON.
 */
app.get("/api/search/movie/simple", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const page = String(req.query.page || 1);
    const pretty = req.query.pretty === "1";
    const save = req.query.save === "1";

    if (!q) return res.status(400).json({ error: "missing q" });
    if (!TMDB_V3_KEY) return res.status(500).json({ error: "server", detail: "TMDB_V3_KEY not set" });

    const url = buildTmdbUrl("/search/movie", {
      query: q,
      include_adult: "false",
      language: "en-US",
      page,
    });

    console.log(`[req] /api/search/movie/simple q="${q}" page=${page}`);
    const r = await fetch(url.toString(), {
      headers: { "Content-Type": "application/json;charset=utf-8" },
      timeout: 15000,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error(`[err] TMDB ${r.status}`, data);
      return res.status(502).json({ error: "upstream", status: r.status, detail: data });
    }

    const items = (data.results || []).map(normalizeMovie);
    const payload = {
      query: q,
      page: data.page || 1,
      total_pages: data.total_pages || 1,
      total_results: data.total_results || 0,
      items,
    };

    if (save) {
      try {
        fs.writeFileSync("last_search.json", JSON.stringify(payload, null, 2), "utf-8");
      } catch (e) {
        console.warn("[warn] could not write last_search.json:", e.message);
      }
    }

    if (pretty) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.send(JSON.stringify(payload, null, 2));
    }
    res.json(payload);
  } catch (e) {
    console.error("[err] server", e);
    res.status(500).json({ error: "server", detail: String(e) });
  }
});

/**
 * GET /api/title/movie/:id
 * Example: /api/title/movie/27205  (Inception)
 * Proxies to TMDB /3/movie/{id} with useful extras — RAW payload
 */
app.get("/api/title/movie/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!TMDB_V3_KEY) return res.status(500).json({ error: "server", detail: "TMDB_V3_KEY not set" });

    const url = buildTmdbUrl(`/movie/${id}`, {
      language: "en-US",
      append_to_response: "credits,watch/providers,videos",
    });

    console.log(`[req] /api/title/movie/${id}`);
    const r = await fetch(url.toString(), {
      headers: { "Content-Type": "application/json;charset=utf-8" },
      timeout: 15000,
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error(`[err] TMDB ${r.status}`, body);
      return res.status(502).json({ error: "upstream", status: r.status, detail: body });
    }
    res.json(body);
  } catch (e) {
    console.error("[err] server", e);
    res.status(500).json({ error: "server", detail: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`Server on http://localhost:${PORT}`);
});

