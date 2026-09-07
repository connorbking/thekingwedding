import { sessionCookie, signSession } from "../../lib/auth.js";
import { isAllowedAdmin, verifyFirebaseIdToken } from "../../lib/firebase.js";
import { json, readJson } from "../../lib/http.js";

export async function onRequestPost(context) {
  let body;
  try {
    body = await readJson(context.request, 8_000);
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const user = await verifyFirebaseIdToken(context.env, body.idToken);
  if (!user) {
    return json({ error: "Google sign-in could not be verified." }, 401);
  }
  if (!isAllowedAdmin(context.env, user.email)) {
    return json({ error: "This Google account is not on the host list." }, 403);
  }
  if (!context.env.ADMIN_SESSION_SECRET) {
    return json({ error: "Admin session secret is not configured." }, 500);
  }

  const token = await signSession(context.env, { email: user.email });
  return json(
    { ok: true, email: user.email },
    200,
    { "Set-Cookie": sessionCookie(context.request, token) }
  );
}
