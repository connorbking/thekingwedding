// Pages serves every range request as 200. iPhone and iPad Safari then refuse
// to play the intro. Slice the file here and answer with 206 Partial Content.

let videoBytes = null;

async function introVideo(env, requestUrl) {
  if (videoBytes) return videoBytes;
  const url = new URL("/public/introVideo.mp4", requestUrl);
  const asset = await env.ASSETS.fetch(
    new Request(url, {
      method: "GET",
      headers: { "Accept-Encoding": "identity" },
    }),
  );
  if (!asset.ok) return asset;
  videoBytes = await asset.arrayBuffer();
  return videoBytes;
}

function byteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(header || "").trim());
  if (!match) return null;
  const startText = match[1];
  const endText = match[2];
  if (startText === "" && endText === "") return null;
  if (startText === "") {
    const suffix = Number(endText);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(startText);
  const end = endText === "" ? size - 1 : Number(endText);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end) return { invalid: true };
  if (start >= size) return { invalid: true };
  return { start, end: Math.min(end, size - 1) };
}

function videoHeaders(size, extra) {
  const headers = new Headers(extra);
  headers.set("Content-Type", "video/mp4");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");
  headers.set("Access-Control-Allow-Origin", "*");
  if (size != null) headers.set("Content-Length", String(size));
  return headers;
}

export async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const loaded = await introVideo(env, request.url);
  if (loaded instanceof Response) return loaded;

  const size = loaded.byteLength;
  const range = byteRange(request.headers.get("Range"), size);
  if (range?.invalid) {
    return new Response(null, {
      status: 416,
      headers: videoHeaders(null, { "Content-Range": `bytes */${size}` }),
    });
  }

  const start = range ? range.start : 0;
  const end = range ? range.end : size - 1;
  const headers = videoHeaders(end - start + 1);
  if (range) headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  if (request.method === "HEAD") return new Response(null, { status: range ? 206 : 200, headers });

  const body = range ? loaded.slice(start, end + 1) : loaded;
  return new Response(body, { status: range ? 206 : 200, headers });
}
