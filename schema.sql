CREATE TABLE IF NOT EXISTS salawath_totals (id INTEGER PRIMARY KEY CHECK(id=1), total INTEGER NOT NULL DEFAULT 0);
INSERT OR IGNORE INTO salawath_totals(id,total) VALUES(1,0);
CREATE TABLE IF NOT EXISTS salawath_events (id INTEGER PRIMARY KEY AUTOINCREMENT, visitor_id TEXT NOT NULL, amount INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_events_created ON salawath_events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_visitor ON salawath_events(visitor_id);
CREATE TABLE IF NOT EXISTS salawath_presence (visitor_id TEXT PRIMARY KEY, display_name TEXT, city TEXT, last_seen TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_presence_seen ON salawath_presence(last_seen);
