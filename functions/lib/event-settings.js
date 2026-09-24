export const EVENT_KEYS = ["shower", "como", "jersey"];

const DEFAULTS = {
  shower: { visible: true, invite: false },
  como: { visible: true, invite: false },
  jersey: { visible: true, invite: false },
};

function flag(value, fallback) {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  return fallback;
}

export async function ensureEventSettings(env) {
  if (!env?.DB) {
    const error = new Error("The guest database is not available.");
    error.status = 503;
    throw error;
  }
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS event_settings (
    event_key TEXT PRIMARY KEY,
    visible INTEGER NOT NULL DEFAULT 1,
    invite INTEGER NOT NULL DEFAULT 0
  )`).run();
  await env.DB.prepare(`INSERT OR IGNORE INTO event_settings (event_key, visible, invite) VALUES
    ('shower', 1, 0),
    ('como', 1, 0),
    ('jersey', 1, 0)`).run();
}

export async function readEventSettings(env) {
  const events = {
    shower: { ...DEFAULTS.shower },
    como: { ...DEFAULTS.como },
    jersey: { ...DEFAULTS.jersey },
  };
  if (!env?.DB) return events;
  try {
    await ensureEventSettings(env);
    const { results } = await env.DB.prepare(
      "SELECT event_key, visible, invite FROM event_settings"
    ).all();
    for (const row of results || []) {
      if (!events[row.event_key]) continue;
      events[row.event_key] = {
        visible: flag(row.visible, true),
        invite: flag(row.invite, false),
      };
    }
  } catch {
    return events;
  }
  return events;
}

export async function writeEventSettings(env, input) {
  await ensureEventSettings(env);
  const source = input && typeof input === "object" ? input : {};
  const statements = EVENT_KEYS.map((key) => {
    const row = source[key] && typeof source[key] === "object" ? source[key] : {};
    const visible = flag(row.visible, true) ? 1 : 0;
    const invite = flag(row.invite, false) ? 1 : 0;
    return env.DB.prepare(
      `INSERT INTO event_settings (event_key, visible, invite) VALUES (?1, ?2, ?3)
       ON CONFLICT(event_key) DO UPDATE SET visible = excluded.visible, invite = excluded.invite`
    ).bind(key, visible, invite);
  });
  await env.DB.batch(statements);
  return readEventSettings(env);
}
