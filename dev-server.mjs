import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 8787;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".json": "application/json",
};

const handlers = {
  "GET /api/invite": "./functions/api/invite.js",
  "POST /api/submissions": "./functions/api/submissions.js",
  "GET /api/address": "./functions/api/address.js",
  "GET /api/admin/submissions": "./functions/api/admin/submissions.js",
};

function loadEnv() {
  const env = { ...process.env };
  const file = path.join(root, ".dev.vars");
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function rewrite(pathname) {
  if (pathname.startsWith("/img/")) return `/public/${pathname.slice(5)}`;
  if (pathname.startsWith("/como/") && pathname !== "/como/index.html") return "/como/index.html";
  if (pathname.startsWith("/jersey/") && pathname !== "/jersey/index.html") return "/jersey/index.html";
  if (pathname.startsWith("/shower/") && pathname !== "/shower/index.html") return "/shower/index.html";
  if (pathname === "/como") return "/como/index.html";
  if (pathname === "/jersey") return "/jersey/index.html";
  if (pathname === "/shower") return "/shower/index.html";
  if (pathname.endsWith("/")) return `${pathname}index.html`;
  return pathname;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function runApi(req, url) {
  const key = `${req.method} ${url.pathname}`;
  const file = handlers[key];
  if (!file) return null;
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body,
  });
  const mod = await import(`${file}?t=${Date.now()}`);
  const handler = req.method === "GET" ? mod.onRequestGet : mod.onRequestPost;
  if (!handler) {
    return new Response(JSON.stringify({ error: "This local route is missing a handler." }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
  return handler({ request, env: loadEnv() });
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      const api = await runApi(req, url);
      if (api) {
        const buffer = Buffer.from(await api.arrayBuffer());
        res.writeHead(api.status, Object.fromEntries(api.headers));
        res.end(buffer);
        return;
      }
    } catch (error) {
      res
        .writeHead(500, { "Content-Type": "application/json; charset=utf-8" })
        .end(JSON.stringify({ error: error.message || "Local API failed." }));
      return;
    }

    let filePath = path.normalize(path.join(root, rewrite(url.pathname)));
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
        return;
      }
      const ext = path.extname(filePath);
      const headers = { "Content-Type": types[ext] || "application/octet-stream" };
      if (ext === ".html" || ext === ".js" || ext === ".css" || ext === ".png") {
        headers["Cache-Control"] = "no-store";
      }
      res.writeHead(200, headers).end(data);
    });
  })
  .listen(port, "127.0.0.1", () => {
    const env = loadEnv();
    const sheet = String(env.GOOGLE_SHEETS_WEBAPP_URL || "").trim();
    console.log(`theking.wedding local → http://127.0.0.1:${port}`);
    console.log(
      sheet
        ? "Google Sheet: using Apps Script web app from .dev.vars"
        : "Google Sheet: missing GOOGLE_SHEETS_WEBAPP_URL in .dev.vars"
    );
  });
