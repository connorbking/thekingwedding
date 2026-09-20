import { cookieHeader } from "./http.js";

export const COOKIE_NAME = "kw_admin";
const WEEK = 60 * 60 * 24 * 7;

function bytesToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function toBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret || "missing-session-secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bytesToHex(signature);
}

function timingEqual(left, right) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length, 32);
  const x = new Uint8Array(length);
  const y = new Uint8Array(length);
  x.set(a);
  y.set(b);
  return crypto.subtle.timingSafeEqual(x, y) && a.length === b.length;
}

export async function signSession(env, { email, ttlSeconds = WEEK } = {}) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const nonce = crypto.randomUUID();
  const emailPart = toBase64Url(email || "");
  const payload = `${exp}.${nonce}.${emailPart}`;
  const signature = await hmacHex(env.ADMIN_SESSION_SECRET, payload);
  return `${payload}.${signature}`;
}

export async function verifySessionToken(env, token) {
  if (!token || !env.ADMIN_SESSION_SECRET) return null;
  const parts = String(token).split(".");
  if (parts.length !== 4) return null;
  const [exp, nonce, emailPart, signature] = parts;
  const payload = `${exp}.${nonce}.${emailPart}`;
  const expected = await hmacHex(env.ADMIN_SESSION_SECRET, payload);
  if (!timingEqual(signature, expected)) return null;
  if (Number(exp) <= Math.floor(Date.now() / 1000)) return null;
  try {
    return { email: fromBase64Url(emailPart) };
  } catch {
    return null;
  }
}

export function readCookie(request, name = COOKIE_NAME) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

export async function readAdminSession(request, env) {
  return verifySessionToken(env, readCookie(request));
}

export async function hasAdminSession(request, env) {
  return Boolean(await readAdminSession(request, env));
}

export function sessionCookie(request, token, maxAge = WEEK) {
  const secure = new URL(request.url).protocol === "https:";
  return cookieHeader(COOKIE_NAME, token, { maxAge, secure });
}

export function clearSessionCookie(request) {
  const secure = new URL(request.url).protocol === "https:";
  return cookieHeader(COOKIE_NAME, "", { maxAge: 0, secure });
}
