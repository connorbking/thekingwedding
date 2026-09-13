import { json, readJson } from "../lib/http.js";
import { appendGuest, lookupInvite, sheetConfigured } from "../lib/sheets.js";
import { validateSubmission } from "../lib/validate.js";

export async function onRequestPost(context) {
  let body;
  try {
    body = await readJson(context.request);
  } catch (error) {
    return json({ error: error.message || "Invalid request." }, error.status || 400);
  }

  const parsed = validateSubmission(body);
  if (parsed.honeypot) return json({ ok: true });
  if (parsed.error) return json({ error: parsed.error }, 400);

  const { submission } = parsed;
  let maxParty = 2;

  if (submission.accessCode && sheetConfigured(context.env)) {
    try {
      const invite = await lookupInvite(context.env, submission.accessCode, submission.event);
      if (invite?.found) {
        maxParty = Number(invite.maxParty) || 2;
        if (!submission.party && invite.greeting) {
          submission.party = String(invite.greeting).trim();
        }
      }
    } catch {
      // Keep the default party size if the sheet lookup fails.
    }
  }

  if (submission.partySize > maxParty) {
    return json({ error: "This invitation cannot include that many guests." }, 400);
  }

  try {
    await appendGuest(context.env, submission);
  } catch (error) {
    return json({ error: error.message }, error.status || 502);
  }

  return json({ ok: true });
}
