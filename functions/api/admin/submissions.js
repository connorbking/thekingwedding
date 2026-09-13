import { json } from "../../lib/http.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const event = (url.searchParams.get("event") || "").trim().toLowerCase();
  const query = (url.searchParams.get("q") || "").trim().toLowerCase();

  let sql = "SELECT * FROM submissions";
  const binds = [];
  if (event === "como" || event === "jersey") {
    sql += " WHERE event = ?";
    binds.push(event);
  }
  sql += " ORDER BY created_at DESC LIMIT 500";

  const { results } = await context.env.DB.prepare(sql).bind(...binds).all();
  const rows = (results || []).filter((row) => {
    if (!query) return true;
    const haystack = [
      row.first_name,
      row.last_name,
      row.email,
      row.phone,
      row.city,
      row.access_code,
      row.additional_guests,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });

  return json({ submissions: rows });
}
