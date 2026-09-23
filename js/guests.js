import { API, GUEST_CODES, LOCAL_PEOPLE, DEFAULT_PARTY_SIZE, EVENT_ORDER, sortEvents } from "./config.js";

export const INVITE_STORAGE_KEY = "king.invite";
export const RESET_HOME_KEY = "king.resetHome";

const EVENT_KEYS = new Set(EVENT_ORDER);
const RESERVED_PARAMS = new Set([
  "code",
  "group",
  "event",
  "view",
  "gate",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
]);

export function normalizeCode(raw) {
  return String(raw || "").trim().toUpperCase();
}

export function groupCodeFromSearch(search = window.location.search) {
  const params = new URLSearchParams(search.startsWith("?") || !search ? search : `?${search}`);
  const named = (params.get("code") || params.get("group") || "").trim();
  if (named) return named.toUpperCase();

  for (const [key, value] of params.entries()) {
    const token = String(key || "").trim();
    if (!token || RESERVED_PARAMS.has(token.toLowerCase())) continue;
    if (!value || value === "1" || value === "true" || token.toUpperCase() === String(value).trim().toUpperCase()) {
      return token.toUpperCase();
    }
    return token.toUpperCase();
  }
  return "";
}

function memberEventKeys(member) {
  if (Array.isArray(member?.events) && member.events.length) {
    return member.events.map((key) => String(key).trim()).filter((key) => EVENT_KEYS.has(key));
  }
  const keys = [];
  if (member?.invite?.shower || member?.shower) keys.push("shower");
  if (member?.invite?.como || member?.como) keys.push("como");
  if (member?.invite?.jersey || member?.jersey) keys.push("jersey");
  return keys;
}

function eventsFrom(match) {
  const members = match?.guests || match?.members || [];
  const fromMembers = [];
  members.forEach((member) => {
    memberEventKeys(member).forEach((key) => {
      if (!fromMembers.includes(key)) fromMembers.push(key);
    });
  });
  const raw = fromMembers.length
    ? fromMembers
    : Array.isArray(match?.events)
      ? match.events
      : String(match?.events || "").split(",");
  return sortEvents(raw.map((key) => String(key).trim()).filter((key) => EVENT_KEYS.has(key)));
}

function guestFromMatch(code, match) {
  const members = Array.isArray(match?.guests) ? match.guests : match?.members || [];
  const events = eventsFrom(match);
  if (!events.length && !members.length && !match?.greeting) return null;
  return {
    code,
    personalized: true,
    greeting: match.greeting || "",
    maxParty: Math.max(1, Number(match.maxParty) || DEFAULT_PARTY_SIZE),
    members,
    events,
  };
}

function localMatch(code) {
  return guestFromMatch(code, GUEST_CODES[code]);
}

export function currentInviteCode() {
  const fromUrl = groupCodeFromSearch();
  if (fromUrl) return fromUrl;
  try {
    const stored = JSON.parse(sessionStorage.getItem(INVITE_STORAGE_KEY) || "null");
    return stored?.code || "";
  } catch {
    return "";
  }
}

export function rememberGuest(guest) {
  if (sessionStorage.getItem(RESET_HOME_KEY)) return;
  if (!guest?.code && !guest?.members?.length) return;
  sessionStorage.setItem(
    INVITE_STORAGE_KEY,
    JSON.stringify({
      code: guest.code || "",
      events: guest.events || [],
      greeting: guest.greeting || "",
      maxParty: guest.maxParty,
      members: guest.members || [],
    }),
  );
}

export function markResetHome() {
  sessionStorage.setItem(RESET_HOME_KEY, "1");
  sessionStorage.removeItem(INVITE_STORAGE_KEY);
  sessionStorage.removeItem("king.detailsConfirmed");
}

export function consumeResetHome() {
  if (!sessionStorage.getItem(RESET_HOME_KEY)) return false;
  sessionStorage.removeItem(RESET_HOME_KEY);
  sessionStorage.removeItem(INVITE_STORAGE_KEY);
  sessionStorage.removeItem("king.detailsConfirmed");
  return true;
}

export function clearGuest() {
  sessionStorage.removeItem(INVITE_STORAGE_KEY);
}

export function readStoredGuest() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(INVITE_STORAGE_KEY) || "null");
    if (!stored?.code && !stored?.members?.length) return null;
    return guestFromMatch(stored.code || "", stored);
  } catch {
    return null;
  }
}

async function inviteFromApi(params) {
  const response = await fetch(`${API.invite}?${params}`);
  const data = await response.json().catch(() => ({}));
  if (data.ambiguous) {
    const error = new Error("ambiguous");
    error.ambiguous = true;
    throw error;
  }
  if (data.error && !data.found) {
    const error = new Error(data.error);
    error.lookupError = true;
    throw error;
  }
  if (!response.ok || !data.found) return null;
  return guestFromMatch(data.code || params.get("code") || "", data);
}

export async function findGuest(rawCode, eventName = "") {
  const code = normalizeCode(rawCode);
  if (!code) return null;

  try {
    const params = new URLSearchParams({ code });
    if (eventName) params.set("event", eventName);
    const match = await inviteFromApi(params);
    if (match) return match;
  } catch (error) {
    if (error.ambiguous || error.lookupError) throw error;
  }

  return localMatch(code);
}

export async function findGuestByName(firstName, lastName, eventName = "") {
  const first = String(firstName || "").trim();
  const last = String(lastName || "").trim();
  if (!first || !last) return null;

  try {
    const params = new URLSearchParams({ first, last });
    if (eventName) params.set("event", eventName);
    const match = await inviteFromApi(params);
    if (match) return match;
  } catch (error) {
    if (error.ambiguous || error.lookupError) throw error;
  }

  const local = LOCAL_PEOPLE.find(
    (person) =>
      person.firstName.toLowerCase() === first.toLowerCase() &&
      person.lastName.toLowerCase() === last.toLowerCase()
  );
  return local ? localMatch(local.code) : null;
}

export async function resolveGuest(eventName = "") {
  const fromUrl = await findGuest(
    groupCodeFromSearch() || new URLSearchParams(window.location.search).get("code"),
    eventName
  );
  if (fromUrl) {
    rememberGuest(fromUrl);
    return fromUrl;
  }

  const stored = readStoredGuest();
  if (stored?.code) {
    try {
      const fresh = await findGuest(stored.code, eventName);
      if (fresh) {
        rememberGuest(fresh);
        return fresh;
      }
    } catch {
      return stored;
    }
  }
  return stored;
}

export function guestCanAccess(guest, eventKey) {
  return Boolean(guest?.events?.includes(eventKey));
}

export function isMultiGuest(guest) {
  return (guest?.events?.length || 0) > 1;
}

export function isDualGuest(guest) {
  return isMultiGuest(guest);
}

export function extraGuestSlots(guest) {
  const named = Array.isArray(guest?.members)
    ? guest.members.filter((row) => String(row.first_name || row.firstName || "").trim() || String(row.last_name || row.lastName || "").trim()).length
    : 0;
  return Math.max(0, (guest?.maxParty || 1) - Math.max(named, 1));
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
