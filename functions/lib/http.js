export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export function cookieHeader(name, value, { maxAge, secure }) {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export async function readJson(request, maxBytes = 60_000) {
  const raw = await request.text();
  if (raw.length > maxBytes) {
    const error = new Error("Payload too large");
    error.status = 413;
    throw error;
  }
  if (!raw) return {};
  return JSON.parse(raw);
}
