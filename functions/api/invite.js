import { json } from "../lib/http.js";
import { lookupInvite, lookupInviteByName, listGuests, sheetConfigured } from "../lib/sheets.js";

function invitePayload(invite, fallbackCode = "") {
  return {
    found: true,
    code: invite.code || fallbackCode,
    greeting: invite.greeting || "",
    maxParty: Number(invite.maxParty) || 2,
    events: invite.events || [],
    guests: invite.guests || [],
  };
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const code = (url.searchParams.get("code") || "").trim().toUpperCase();
  const first = (url.searchParams.get("first") || "").trim();
  const last = (url.searchParams.get("last") || "").trim();
  const event = (url.searchParams.get("event") || "").trim().toLowerCase();

  if (url.searchParams.get("warm")) {
    if (sheetConfigured(context.env)) {
      await listGuests(context.env).catch(() => {});
    }
    return json({ ok: true });
  }

  if (!code && !(first && last)) return json({ found: false });
  if (!sheetConfigured(context.env)) {
    return json({ found: false, error: "The Google Sheet connection is not set yet." }, 503);
  }

  try {
    if (first && last) {
      const invite = await lookupInviteByName(context.env, first, last, event);
      if (invite?.ambiguous) {
        return json({ found: true, ambiguous: true });
      }
      if (!invite?.found) return json({ found: false });
      return json(invitePayload(invite));
    }

    const invite = await lookupInvite(context.env, code, event);
    if (!invite?.found) return json({ found: false });
    return json(invitePayload(invite, code));
  } catch (error) {
    return json({ error: error.message || "The guest list could not be reached." }, error.status || 502);
  }
}
