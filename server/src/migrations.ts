// Append-only. Each entry runs once, in order, tracked by PRAGMA user_version.
// Never edit a migration that has shipped; add a new one instead.

export const MIGRATIONS: readonly string[] = [
  // 1: people, memberships, money, gate
  `
  CREATE TABLE staff (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 60),
    role        TEXT NOT NULL CHECK (role IN ('owner', 'desk')),
    pin_hash    TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    modified_at TEXT NOT NULL
  );

  CREATE TABLE members (
    id            INTEGER PRIMARY KEY,
    full_name     TEXT NOT NULL CHECK (length(full_name) BETWEEN 2 AND 80),
    phone         TEXT NOT NULL UNIQUE CHECK (length(phone) = 10 AND phone NOT GLOB '*[^0-9]*'),
    password_hash TEXT NOT NULL,
    birth_year    INTEGER CHECK (birth_year BETWEEN 1920 AND 2015),
    gender        TEXT CHECK (gender IN ('f', 'm', 'x')),
    height_cm     INTEGER CHECK (height_cm BETWEEN 120 AND 230),
    weight_kg     REAL CHECK (weight_kg BETWEEN 30 AND 250),
    goal          TEXT CHECK (goal IN ('lose', 'gain', 'fit', 'strength')),
    qr_secret     TEXT NOT NULL CHECK (length(qr_secret) = 64),
    created_at    TEXT NOT NULL,
    modified_at   TEXT NOT NULL,
    created_by    INTEGER REFERENCES staff(id)
  );

  CREATE TABLE plans (
    id                  INTEGER PRIMARY KEY,
    name                TEXT NOT NULL UNIQUE,
    duration_days       INTEGER NOT NULL CHECK (duration_days > 0),
    price_kurus         INTEGER NOT NULL CHECK (price_kurus > 0),
    freeze_days_allowed INTEGER NOT NULL DEFAULT 0 CHECK (freeze_days_allowed >= 0),
    is_active           INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at          TEXT NOT NULL,
    modified_at         TEXT NOT NULL
  );

  CREATE TABLE memberships (
    id               INTEGER PRIMARY KEY,
    member_id        INTEGER NOT NULL REFERENCES members(id),
    plan_id          INTEGER NOT NULL REFERENCES plans(id),
    starts_on        TEXT NOT NULL,
    ends_on          TEXT NOT NULL,
    status           TEXT NOT NULL CHECK (status IN ('active', 'frozen', 'expired', 'cancelled')),
    frozen_from      TEXT,
    freeze_days_used INTEGER NOT NULL DEFAULT 0 CHECK (freeze_days_used >= 0),
    price_kurus      INTEGER NOT NULL CHECK (price_kurus >= 0),
    created_at       TEXT NOT NULL,
    modified_at      TEXT NOT NULL,
    created_by       INTEGER REFERENCES staff(id),
    CHECK (ends_on >= starts_on),
    CHECK ((status = 'frozen') = (frozen_from IS NOT NULL))
  );
  CREATE INDEX idx_memberships_member ON memberships(member_id, ends_on);

  CREATE TABLE payments (
    id            INTEGER PRIMARY KEY,
    membership_id INTEGER NOT NULL REFERENCES memberships(id),
    amount_kurus  INTEGER NOT NULL CHECK (amount_kurus > 0),
    method        TEXT NOT NULL CHECK (method IN ('cash', 'card', 'transfer')),
    created_at    TEXT NOT NULL,
    created_by    INTEGER REFERENCES staff(id)
  );
  CREATE INDEX idx_payments_created ON payments(created_at);

  CREATE TABLE checkins (
    id         INTEGER PRIMARY KEY,
    member_id  INTEGER REFERENCES members(id),
    direction  TEXT CHECK (direction IN ('in', 'out')),
    result     TEXT NOT NULL CHECK (result IN ('granted', 'denied')),
    reason     TEXT,
    gate       TEXT NOT NULL DEFAULT 'kapi-1',
    created_at TEXT NOT NULL,
    CHECK ((result = 'granted') = (reason IS NULL)),
    CHECK (result = 'denied' OR (member_id IS NOT NULL AND direction IS NOT NULL))
  );
  CREATE INDEX idx_checkins_member ON checkins(member_id, created_at);
  CREATE INDEX idx_checkins_created ON checkins(created_at);

  -- One row per accepted (member, step, direction): the primary key is the replay guard.
  CREATE TABLE gate_code_uses (
    member_id  INTEGER NOT NULL REFERENCES members(id),
    step       INTEGER NOT NULL,
    direction  TEXT NOT NULL CHECK (direction IN ('in', 'out')),
    created_at TEXT NOT NULL,
    PRIMARY KEY (member_id, step, direction)
  );
  `,
];
