-- Idempotent additions, run on every open: schema.sql runs only for a new file,
-- so anything a live database must gain lives here and nowhere else.
INSERT OR IGNORE INTO facility_types VALUES
    ('COOL', 'Cool place: library, community centre or pool', 0, 'heat');

-- A current heat or severe weather notice from the VicEmergency feed. The outer
-- rings of the named area travel to the phone, which matches its own point.
CREATE TABLE IF NOT EXISTS conditions (
    condition_id        TEXT PRIMARY KEY,
    hazard              TEXT NOT NULL CHECK (hazard IN ('heat','storm')),
    title               TEXT NOT NULL,
    publisher           TEXT NOT NULL,
    level               TEXT,
    url                 TEXT,
    statewide           INTEGER NOT NULL DEFAULT 0,
    rings_json          TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
    source_updated_at   TEXT NOT NULL,
    ingested_at         TEXT NOT NULL,
    closed_at           TEXT
);
