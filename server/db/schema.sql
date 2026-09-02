PRAGMA journal_mode = WAL;      -- lets the live poller write without blocking reads
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

CREATE TABLE facility_types (
    type_code       TEXT PRIMARY KEY,
    description     TEXT NOT NULL,
    is_dynamic      INTEGER NOT NULL DEFAULT 0,
    hazard_scope    TEXT NOT NULL DEFAULT 'all_hazards'
);

INSERT INTO facility_types VALUES
    ('NSP',      'Neighbourhood Safer Place / Bushfire Place of Last Resort', 0, 'bushfire_only'),
    ('CFR',      'Community Fire Refuge',                                     0, 'bushfire_only'),
    ('ERC',      'Emergency Relief Centre',                                   1, 'all_hazards'),
    ('RELIEF',   'Relief Centre',                                             1, 'all_hazards'),
    ('RECOVERY', 'Recovery Centre',                                           1, 'all_hazards'),
    ('ASSEMBLY', 'Assembly Area',                                             1, 'all_hazards');

CREATE TABLE data_sources (
    source_id                TEXT PRIMARY KEY,
    name                     TEXT NOT NULL,
    source_kind              TEXT NOT NULL CHECK (source_kind IN ('static','dynamic')),
    endpoint_url             TEXT,
    refresh_interval_seconds INTEGER NOT NULL,
    last_attempt_at          TEXT,
    last_success_at          TEXT,
    consecutive_failures     INTEGER NOT NULL DEFAULT 0,
    status                   TEXT NOT NULL DEFAULT 'unknown'
                              CHECK (status IN ('healthy','degraded','down','unknown')),
    last_error               TEXT
);

CREATE TABLE postcodes (
    postcode         TEXT PRIMARY KEY,
    locality_name    TEXT,
    lga_name         TEXT,
    centroid_lat     REAL NOT NULL,
    centroid_lon     REAL NOT NULL,
    boundary_geojson TEXT,
    updated_at       TEXT NOT NULL
);

CREATE VIRTUAL TABLE postcodes_rtree USING rtree(
    id, min_lat, max_lat, min_lon, max_lon
);

CREATE TABLE facilities (
    facility_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id           TEXT NOT NULL REFERENCES data_sources(source_id),
    external_ref        TEXT,
    type_code           TEXT NOT NULL REFERENCES facility_types(type_code),
    name                TEXT NOT NULL,
    address              TEXT,
    lat                  REAL NOT NULL,
    lon                  REAL NOT NULL,
    lga_name             TEXT,
    capacity              INTEGER,
    designation_status    TEXT NOT NULL DEFAULT 'designated'
                          CHECK (designation_status IN ('designated','candidate','needs_review','decommissioned')),
    last_verified_at      TEXT NOT NULL,
    created_at             TEXT NOT NULL,
    updated_at              TEXT NOT NULL,
    UNIQUE (source_id, external_ref)
);

CREATE VIRTUAL TABLE facilities_rtree USING rtree(
    id, min_lat, max_lat, min_lon, max_lon
);

CREATE TRIGGER facilities_ai AFTER INSERT ON facilities BEGIN
    INSERT INTO facilities_rtree VALUES (new.facility_id, new.lat, new.lat, new.lon, new.lon);
END;
CREATE TRIGGER facilities_au AFTER UPDATE OF lat, lon ON facilities BEGIN
    UPDATE facilities_rtree SET min_lat=new.lat, max_lat=new.lat, min_lon=new.lon, max_lon=new.lon
    WHERE id = new.facility_id;
END;
CREATE TRIGGER facilities_ad AFTER DELETE ON facilities BEGIN
    DELETE FROM facilities_rtree WHERE id = old.facility_id;
END;

-- Precomputed nearest-facility-per-postcode for STATIC types ONLY.
-- Dynamic types are never cached here — see activations below.
CREATE TABLE postcode_nearest_static (
    postcode        TEXT NOT NULL REFERENCES postcodes(postcode),
    type_code       TEXT NOT NULL REFERENCES facility_types(type_code),
    facility_id     INTEGER REFERENCES facilities(facility_id),
    distance_km     REAL,
    computed_at     TEXT NOT NULL,
    PRIMARY KEY (postcode, type_code)
);

CREATE TABLE incidents (
    incident_id        TEXT PRIMARY KEY,
    category            TEXT,
    status               TEXT,
    headline             TEXT,
    geometry_geojson     TEXT,
    source_updated_at    TEXT,
    ingested_at            TEXT NOT NULL
);

CREATE TABLE activations (
    activation_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id           TEXT NOT NULL REFERENCES data_sources(source_id),
    external_ref        TEXT NOT NULL,
    type_code            TEXT NOT NULL REFERENCES facility_types(type_code),
    name                  TEXT NOT NULL,
    address                TEXT,
    lat                    REAL NOT NULL,
    lon                     REAL NOT NULL,
    incident_id              TEXT REFERENCES incidents(incident_id),
    status                    TEXT NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','closed','planned')),
    opened_at                 TEXT,
    closed_at                  TEXT,
    source_updated_at           TEXT NOT NULL,
    ingested_at                  TEXT NOT NULL,
    UNIQUE (source_id, external_ref)
);

CREATE VIRTUAL TABLE activations_rtree USING rtree(
    id, min_lat, max_lat, min_lon, max_lon
);
CREATE TRIGGER activations_ai AFTER INSERT ON activations BEGIN
    INSERT INTO activations_rtree VALUES (new.activation_id, new.lat, new.lat, new.lon, new.lon);
END;
CREATE TRIGGER activations_au AFTER UPDATE OF lat, lon ON activations BEGIN
    UPDATE activations_rtree SET min_lat=new.lat, max_lat=new.lat, min_lon=new.lon, max_lon=new.lon
    WHERE id = new.activation_id;
END;
CREATE TRIGGER activations_ad AFTER DELETE ON activations BEGIN
    DELETE FROM activations_rtree WHERE id = old.activation_id;
END;

CREATE INDEX idx_activations_status_type ON activations(status, type_code);

CREATE TABLE sync_log (
    log_id              INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id            TEXT NOT NULL REFERENCES data_sources(source_id),
    run_started_at         TEXT NOT NULL,
    run_finished_at          TEXT,
    records_seen               INTEGER,
    records_added                INTEGER,
    records_updated                INTEGER,
    status                          TEXT NOT NULL CHECK (status IN ('success','partial','failed')),
    error_detail                     TEXT
);

CREATE INDEX idx_sync_log_source_time ON sync_log(source_id, run_started_at);
