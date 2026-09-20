import { readAdminSession } from "../../lib/auth.js";
import { json } from "../../lib/http.js";

export async function onRequestGet(context) {
  const session = await readAdminSession(context.request, context.env);
  return json({ ok: true, email: session?.email || "" });
}
