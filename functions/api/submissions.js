import { json, readJson } from "../lib/http.js";
import { appendGuest, lookupInvite, mirrorGuestsToSheet, sheetConfigured } from "../lib/sheets.js";
import { validateSubmission } from "../lib/validate.js";

function personName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function lockInvitedGuests(submission, invite) {
  const roster = Array.isArray(invite?.guests) ? invite.guests : [];
  const byId = new Map();
  roster.forEach((member) => {
    const id = String(member.id || "");
    if (id) byId.set(id, member);
  });

  const seen = new Set();
  const guests = [];
  for (const guest of submission.guests) {
    const member = byId.get(guest.id);
    const first = member?.first_name || member?.firstName || "";
    const last = member?.last_name || member?.lastName || "";
    if (
      !member ||
      seen.has(guest.id) ||
      personName(first) !== personName(guest.firstName) ||
      personName(last) !== personName(guest.lastName)
    ) {
      return { error: "Names on this invitation cannot be changed." };
    }
    seen.add(guest.id);
    guests.push({
      ...guest,
      firstName: String(first).trim(),
      lastName: String(last).trim(),
    });
  }
  return { guests };
}

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
  if (!submission.accessCode) {
    return json({ error: "This invitation could not be matched." }, 400);
  }
  if (!sheetConfigured(context.env)) {
    return json({ error: "This invitation could not be matched." }, 503);
  }

  let invite;
  try {
    const event = submission.kind === "rsvp" ? submission.event : "";
    invite = await lookupInvite(context.env, submission.accessCode, event);
  } catch {
    return json({ error: "The guest list could not be reached." }, 502);
  }
  if (!invite?.found) {
    return json({ error: "This invitation could not be matched." }, 400);
  }
  if (!submission.party && invite.greeting) {
    submission.party = String(invite.greeting).trim();
  }

  if (Array.isArray(submission.guests) && submission.guests.length) {
    const locked = lockInvitedGuests(submission, invite);
    if (locked.error) return json({ error: locked.error }, 400);
    submission.guests = locked.guests;
    submission.extras = locked.guests.slice(1);
    submission.partySize = locked.guests.length;
    submission.firstName = locked.guests[0].firstName;
    submission.lastName = locked.guests[0].lastName;
  } else {
    const roster = Array.isArray(invite.guests) ? invite.guests : [];
    const match = roster.find(
      (member) =>
        personName(member.first_name || member.firstName) === personName(submission.firstName) &&
        personName(member.last_name || member.lastName) === personName(submission.lastName),
    );
    if (!match || submission.extras?.length) {
      return json({ error: "Names on this invitation cannot be changed." }, 400);
    }
    submission.firstName = String(match.first_name || match.firstName || "").trim();
    submission.lastName = String(match.last_name || match.lastName || "").trim();
    submission.partySize = 1;
  }

  let saved;
  try {
    saved = await appendGuest(context.env, submission);
  } catch (error) {
    return json({ error: error.message }, error.status || 502);
  }

  const mirror = mirrorGuestsToSheet(context.env, submission, saved.guests);
  if (typeof context.waitUntil === "function") context.waitUntil(mirror);
  else await mirror;

  return json({ ok: true });
}
