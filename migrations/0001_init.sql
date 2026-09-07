CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  event TEXT NOT NULL,
  access_code TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  street TEXT NOT NULL,
  apt TEXT,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  postal TEXT NOT NULL,
  country TEXT NOT NULL,
  additional_guests TEXT,
  party_size INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_event ON submissions(event);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_email ON submissions(email);

CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  greeting TEXT NOT NULL,
  max_party INTEGER NOT NULL DEFAULT 2,
  events TEXT NOT NULL DEFAULT 'como,jersey',
  notes TEXT,
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO invites (code, greeting, max_party, events, notes, created_at)
VALUES ('DEMO', 'our honored guests', 4, 'como,jersey', 'Sample household code', '2026-09-07T00:00:00.000Z');
