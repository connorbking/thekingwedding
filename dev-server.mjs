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

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
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
      res.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream" }).end(data);
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`theking.wedding local → http://127.0.0.1:${port}`);
  });
