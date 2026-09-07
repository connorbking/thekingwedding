import { API, GUEST_CODES, DEFAULT_PARTY_SIZE } from "./config.js";

function generic(code = "") {
  return {
    code,
    personalized: false,
    greeting: "",
    maxParty: DEFAULT_PARTY_SIZE,
  };
}

export async function resolveGuest(eventName = "") {
  const raw = new URLSearchParams(window.location.search).get("code") || "";
  const code = raw.trim().toUpperCase();
  if (!code) return generic();

  try {
    const params = new URLSearchParams({ code });
    if (eventName) params.set("event", eventName);
    const response = await fetch(`${API.invite}?${params}`);
    if (response.ok) {
      const data = await response.json();
      if (data.found) {
        return {
          code,
          personalized: true,
          greeting: data.greeting,
          maxParty: Math.max(1, Number(data.maxParty) || DEFAULT_PARTY_SIZE),
        };
      }
    }
  } catch {
    const match = GUEST_CODES[code];
    if (match) {
      return {
        code,
        personalized: true,
        greeting: match.greeting,
        maxParty: Math.max(1, Number(match.maxParty) || DEFAULT_PARTY_SIZE),
      };
    }
  }

  const match = GUEST_CODES[code];
  if (match) {
    return {
      code,
      personalized: true,
      greeting: match.greeting,
      maxParty: Math.max(1, Number(match.maxParty) || DEFAULT_PARTY_SIZE),
    };
  }

  return generic(code);
}

export function extraGuestSlots(guest) {
  return Math.max(0, guest.maxParty - 1);
}
