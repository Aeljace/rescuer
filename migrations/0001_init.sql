CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_name TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  emergency_type TEXT NOT NULL,
  description TEXT NOT NULL,
  people_count INTEGER NOT NULL DEFAULT 1,
  latitude REAL,
  longitude REAL,
  accuracy REAL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reports_status_created
ON reports(status, created_at DESC);

CREATE TABLE IF NOT EXISTS rescue_beacons (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  manufacturer_token TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rescue_events (
  id TEXT PRIMARY KEY,
  report_id TEXT,
  event_type TEXT NOT NULL,
  beacon_token TEXT,
  beacon_label TEXT,
  rssi INTEGER,
  latitude REAL,
  longitude REAL,
  created_at TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (report_id) REFERENCES reports(id)
);

CREATE INDEX IF NOT EXISTS idx_rescue_events_report_created
ON rescue_events(report_id, created_at DESC);
