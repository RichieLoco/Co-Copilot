// Production server for Co-Copilot
// Serves the built React app from dist/ and proxies API calls to GitHub
// to bypass browser CORS restrictions.

import express from "express";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression());

// Proxy: /api/models/* -> https://models.github.ai/*
app.use("/api/models", async (req, res) => {
  const targetUrl = `https://models.github.ai${req.url}`;
  await proxyRequest(req, res, targetUrl);
});

// Proxy: /api/gh/* -> https://api.github.com/*
app.use("/api/gh", async (req, res) => {
  const targetUrl = `https://api.github.com${req.url}`;
  await proxyRequest(req, res, targetUrl);
});

async function proxyRequest(req, res, targetUrl) {
  try {
    // Forward client headers, replace Host
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (!["host", "content-length", "connection"].includes(k.toLowerCase())) {
        headers[k] = v;
      }
    }

    // Collect request body (for POST/PUT)
    let body;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = Buffer.concat(chunks);
    }

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    // Forward upstream status and headers
    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      // Skip headers that Express manages
      if (!["content-encoding", "transfer-encoding", "connection"].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // Stream upstream response body to client (supports SSE for chat streaming)
    if (upstream.body) {
      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(502).json({ error: "Upstream request failed", message: err.message });
  }
}

// Serve static SPA build
app.use(express.static(path.join(__dirname, "dist")));

// SPA fallback — any unknown route returns index.html so React Router (if added later) works
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✓ Co-Copilot running on http://0.0.0.0:${PORT}`);
  console.log(`  Local:    http://localhost:${PORT}`);
  console.log(`  Network:  Access from any device on your LAN`);
});
