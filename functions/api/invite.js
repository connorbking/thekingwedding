import { json } from "../lib/http.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const code = (url.searchParams.get("code") || "").trim().toUpperCase();
  const event = (url.searchParams.get("event") || "").trim().toLowerCase();

  if (!code) return json({ found: false });

  const invite = await context.env.DB.prepare(
    "SELECT code, greeting, max_party, events FROM invites WHERE code = ?"
  )
    .bind(code)
    .first();

  if (!invite) return json({ found: false });

  const events = String(invite.events || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (event && !events.includes(event)) return json({ found: false });

  return json({
    found: true,
    code: invite.code,
    greeting: invite.greeting,
    maxParty: Number(invite.max_party) || 2,
    events,
  });
}
