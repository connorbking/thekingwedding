import { json } from "../../lib/http.js";
import { GUEST_SHEET_URL, listGuests, sheetConfigured } from "../../lib/sheets.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const event = (url.searchParams.get("event") || "").trim().toLowerCase();
  const query = (url.searchParams.get("q") || "").trim().toLowerCase();

  if (!sheetConfigured(context.env)) {
    return json({ submissions: [], sheetUrl: GUEST_SHEET_URL, configured: false });
  }

  let submissions = [];
  try {
    const data = await listGuests(context.env);
    submissions = data.submissions || [];
  } catch (error) {
    return json({ error: error.message, submissions: [], sheetUrl: GUEST_SHEET_URL }, error.status || 502);
  }

  const rows = submissions.filter((row) => {
    const events = Array.isArray(row.events) ? row.events : [row.event].filter(Boolean);
    if (event === "como" || event === "jersey" || event === "shower") {
      if (!events.includes(event) && row.event !== event) return false;
    }
    if (!query) return true;
    return [
      row.party,
      row.access_code,
      row.group_code,
      row.first_name,
      row.last_name,
      row.email,
      row.phone,
      row.city,
      row.region,
      row.postal,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  return json({ submissions: rows, sheetUrl: GUEST_SHEET_URL, configured: true });
}
