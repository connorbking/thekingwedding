import { json } from "../lib/http.js";
import { sheetConfigured } from "../lib/sheets.js";
import { pullSiteContacts, pushSheetGuests, syncAuthorized } from "../lib/sync.js";

async function readBody(request) {
  const raw = await request.text();
  if (raw.length > 1_500_000) {
    const error = new Error("Payload too large");
    error.status = 413;
    throw error;
  }
  if (!raw) return {};
  return JSON.parse(raw);
}

export async function onRequestPost(context) {
  if (!syncAuthorized(context.request, context.env)) {
    return json({ error: "The sync request was not authorized." }, 401);
  }
  if (!sheetConfigured(context.env)) {
    return json({ error: "The guest database is not available." }, 503);
  }

  let body;
  try {
    body = await readBody(context.request);
  } catch (error) {
    return json({ error: error.message || "Invalid request." }, error.status || 400);
  }

  try {
    if (body.action === "pull") {
      return json(await pullSiteContacts(context.env, body.since));
    }
    if (body.action === "push") {
      const guests = Array.isArray(body.guests) ? body.guests : [];
      if (guests.length > 2000) return json({ error: "Too many guests in one sync." }, 400);
      return json(await pushSheetGuests(context.env, guests, {
        replace: Boolean(body.replace),
        keepSiteContact: body.contact === "keep-site",
      }));
    }
    return json({ error: "Unknown sync action." }, 400);
  } catch (error) {
    return json({ error: error.message || "The guest database could not be updated." }, error.status || 502);
  }
}
