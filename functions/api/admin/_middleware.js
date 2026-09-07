import { hasAdminSession } from "../../lib/auth.js";
import { json } from "../../lib/http.js";

export async function onRequest(context) {
  const path = new URL(context.request.url).pathname;
  if (path === "/api/admin/login" || context.request.method === "OPTIONS") {
    return context.next();
  }

  if (!(await hasAdminSession(context.request, context.env))) {
    return json({ error: "Unauthorized" }, 401);
  }

  return context.next();
}
