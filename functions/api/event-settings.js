import { readEventSettings } from "../lib/event-settings.js";
import { json } from "../lib/http.js";

export async function onRequestGet(context) {
  const events = await readEventSettings(context.env);
  return json({ events });
}
