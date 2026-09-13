import { json } from "../../../lib/http.js";
import { deleteGuest } from "../../../lib/sheets.js";

export async function onRequestDelete(context) {
  const id = decodeURIComponent(context.params.id || "");
  if (!id) return json({ error: "Missing submission." }, 400);

  try {
    const result = await deleteGuest(context.env, id);
    if (result.ok === false) return json({ error: "Not found." }, 404);
    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message }, error.status || 502);
  }
}
