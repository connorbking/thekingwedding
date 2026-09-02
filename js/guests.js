import { GUEST_CODES, DEFAULT_PARTY_SIZE } from "./config.js";

export function resolveGuest() {
  const raw = new URLSearchParams(window.location.search).get("code") || "";
  const code = raw.trim().toUpperCase();
  const match = code ? GUEST_CODES[code] : null;

  if (match) {
    return {
      code,
      personalized: true,
      greeting: match.greeting,
      maxParty: Math.max(1, Number(match.maxParty) || DEFAULT_PARTY_SIZE),
    };
  }

  return {
    code,
    personalized: false,
    greeting: "",
    maxParty: DEFAULT_PARTY_SIZE,
  };
}

export function extraGuestSlots(guest) {
  return Math.max(0, guest.maxParty - 1);
}
