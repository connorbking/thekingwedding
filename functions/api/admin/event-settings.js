import { readEventSettings, writeEventSettings } from "../../lib/event-settings.js";
import { json, readJson } from "../../lib/http.js";

export async function onRequestGet(context) {
  const events = await readEventSettings(context.env);
  return json({ events });
}

export async function onRequestPut(context) {
  let body;
  try {
    body = await readJson(context.request, 4_000);
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  try {
    const events = await writeEventSettings(context.env, body.events);
    return json({ events });
  } catch (error) {
    return json({ error: error.message || "The event switches could not be saved." }, error.status || 500);
  }
}
