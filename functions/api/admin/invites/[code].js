import { json, readJson } from "../../../lib/http.js";
import { validateInvite } from "../../../lib/validate.js";

export async function onRequestPut(context) {
  const currentCode = String(context.params.code || "").toUpperCase();
  let body;
  try {
    body = await readJson(context.request);
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const parsed = validateInvite({ ...body, code: currentCode });
  if (parsed.error) return json({ error: parsed.error }, 400);

  const result = await context.env.DB.prepare(
    "UPDATE invites SET greeting = ?, max_party = ?, events = ?, notes = ? WHERE code = ?"
  )
    .bind(
      parsed.invite.greeting,
      parsed.invite.maxParty,
      parsed.invite.events,
      parsed.invite.notes || null,
      currentCode
    )
    .run();

  if (!result.meta?.changes) return json({ error: "Not found." }, 404);
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const code = String(context.params.code || "").toUpperCase();
  const result = await context.env.DB.prepare("DELETE FROM invites WHERE code = ?")
    .bind(code)
    .run();
  if (!result.meta?.changes) return json({ error: "Not found." }, 404);
  return json({ ok: true });
}
