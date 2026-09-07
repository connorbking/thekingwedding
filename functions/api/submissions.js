import { json, readJson } from "../lib/http.js";
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

  if (submission.accessCode) {
    const invite = await context.env.DB.prepare(
      "SELECT max_party, events FROM invites WHERE code = ?"
    )
      .bind(submission.accessCode)
      .first();

    if (invite) {
      const events = String(invite.events || "")
        .split(",")
        .map((item) => item.trim());
      if (events.includes(submission.event)) {
        maxParty = Number(invite.max_party) || 2;
      }
    }
  }

  if (submission.partySize > maxParty) {
    return json({ error: "This invitation cannot include that many guests." }, 400);
  }

  await context.env.DB.prepare(
    `INSERT INTO submissions (
      id, created_at, event, access_code, first_name, last_name, phone, email,
      street, apt, city, region, postal, country, additional_guests, party_size
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      new Date().toISOString(),
      submission.event,
      submission.accessCode || null,
      submission.firstName,
      submission.lastName,
      submission.phone,
      submission.email,
      submission.street,
      submission.apt || null,
      submission.city,
      submission.region,
      submission.postal,
      submission.country,
      JSON.stringify(submission.extras),
      submission.partySize
    )
    .run();

  return json({ ok: true });
}
