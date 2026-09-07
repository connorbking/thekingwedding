import { json } from "../../../lib/http.js";

export async function onRequestDelete(context) {
  const id = context.params.id;
  if (!id) return json({ error: "Missing submission." }, 400);

  const result = await context.env.DB.prepare("DELETE FROM submissions WHERE id = ?")
    .bind(id)
    .run();

  if (!result.meta?.changes) return json({ error: "Not found." }, 404);
  return json({ ok: true });
}
