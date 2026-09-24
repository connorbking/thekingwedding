CREATE TABLE IF NOT EXISTS event_settings (
  event_key TEXT PRIMARY KEY,
  visible INTEGER NOT NULL DEFAULT 1,
  invite INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO event_settings (event_key, visible, invite) VALUES
  ('shower', 1, 0),
  ('como', 1, 0),
  ('jersey', 1, 0);
