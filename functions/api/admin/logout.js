import { clearSessionCookie } from "../../lib/auth.js";
import { json } from "../../lib/http.js";

export async function onRequestPost(context) {
  return json({ ok: true }, 200, {
    "Set-Cookie": clearSessionCookie(context.request),
  });
}
