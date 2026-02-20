CREATE TABLE IF NOT EXISTS request (
  id         TEXT PRIMARY KEY,
  url        TEXT NOT NULL,
  hostname   TEXT NOT NULL,
  path       TEXT NOT NULL,
  query      TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_request_hostname   ON request(hostname);
CREATE INDEX idx_request_created_at ON request(created_at);
