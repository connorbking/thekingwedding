import { json, readJson } from "../../lib/http.js";
import { validateInvite } from "../../lib/validate.js";

export async function onRequestGet(context) {
  const { results } = await context.env.DB.prepare(
    "SELECT * FROM invites ORDER BY created_at DESC"
  ).all();
  return json({ invites: results || [] });
}

export async function onRequestPost(context) {
  let body;
  try {
    body = await readJson(context.request);
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const parsed = validateInvite(body);
  if (parsed.error) return json({ error: parsed.error }, 400);

  const { invite } = parsed;
  try {
    await context.env.DB.prepare(
      `INSERT INTO invites (code, greeting, max_party, events, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        invite.code,
        invite.greeting,
        invite.maxParty,
        invite.events,
        invite.notes || null,
        new Date().toISOString()
      )
      .run();
  } catch (error) {
    if (String(error.message || "").includes("UNIQUE")) {
      return json({ error: "That invite code already exists." }, 409);
    }
    throw error;
  }

  return json({ ok: true, invite }, 201);
}
