import { GUEST_CODES, DEFAULT_PARTY_SIZE } from "./config.js";

export const INVITE_STORAGE_KEY = "king.invite";

const EVENT_KEYS = new Set(["como", "jersey"]);

export function normalizeCode(raw) {
  return (raw || "").trim().toUpperCase();
}

function eventsFrom(match) {
  if (!Array.isArray(match.events)) return [];
  const events = match.events.filter((key) => EVENT_KEYS.has(key));
  if (events.includes("como") && !events.includes("jersey")) {
    events.push("jersey");
  }
  return events;
}

export function lookupGuest(rawCode) {
  const code = normalizeCode(rawCode);
  const match = code ? GUEST_CODES[code] : null;
  if (!match) return null;

  const events = eventsFrom(match);
  if (!events.length) return null;

  return {
    code,
    personalized: true,
    greeting: match.greeting || "",
    maxParty: Math.max(1, Number(match.maxParty) || DEFAULT_PARTY_SIZE),
    events,
  };
}

function readStoredGuest() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(INVITE_STORAGE_KEY) || "null");
    if (!stored?.code) return null;
    return lookupGuest(stored.code);
  } catch {
    return null;
  }
}

export function rememberGuest(guest) {
  if (!guest?.code) return;
  sessionStorage.setItem(
    INVITE_STORAGE_KEY,
    JSON.stringify({ code: guest.code, events: guest.events }),
  );
}

export function clearGuest() {
  sessionStorage.removeItem(INVITE_STORAGE_KEY);
}

export function resolveGuest() {
  const fromUrl = lookupGuest(new URLSearchParams(window.location.search).get("code"));
  if (fromUrl) {
    rememberGuest(fromUrl);
    return fromUrl;
  }
  return readStoredGuest();
}

export function guestCanAccess(guest, eventKey) {
  return Boolean(guest?.events?.includes(eventKey));
}

export function isDualGuest(guest) {
  return Boolean(guest?.events?.includes("como") && guest?.events?.includes("jersey"));
}

export function extraGuestSlots(guest) {
  return Math.max(0, (guest?.maxParty || 1) - 1);
}

export function withCode(path, code) {
  const url = new URL(path, window.location.origin);
  if (code) url.searchParams.set("code", code);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function eventHref(eventKey, code, view = "save-the-date") {
  return withCode(`/${eventKey}/${view}`, code);
}

export function gateHref(code) {
  const url = new URL("/", window.location.origin);
  url.searchParams.set("gate", "1");
  if (code) url.searchParams.set("code", code);
  return `${url.pathname}${url.search}`;
}
