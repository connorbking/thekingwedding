CREATE TABLE guests (
  public_id TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL,
  party TEXT NOT NULL DEFAULT '',
  group_code TEXT NOT NULL DEFAULT '',
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  first_key TEXT NOT NULL DEFAULT '',
  last_key TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  street TEXT NOT NULL DEFAULT '',
  apt TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  postal TEXT NOT NULL DEFAULT '',
  invite_jersey INTEGER NOT NULL DEFAULT 0,
  invite_como INTEGER NOT NULL DEFAULT 0,
  invite_shower INTEGER NOT NULL DEFAULT 0,
  rsvp_jersey TEXT NOT NULL DEFAULT '',
  rsvp_como TEXT NOT NULL DEFAULT '',
  rsvp_shower TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_guests_group ON guests(group_code);
CREATE INDEX idx_guests_name ON guests(first_key, last_key);
