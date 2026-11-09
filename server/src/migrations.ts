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

  // 2: training (program library, enrolments, guided workouts). Gate codes now carry the presence
  // sequence, which makes the replay table redundant.
  `
  DROP TABLE gate_code_uses;

  CREATE TABLE exercises (
    id            INTEGER PRIMARY KEY,
    slug          TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    muscle_group  TEXT NOT NULL,
    equipment     TEXT NOT NULL,
    is_lower_body INTEGER NOT NULL CHECK (is_lower_body IN (0, 1)),
    is_bodyweight INTEGER NOT NULL CHECK (is_bodyweight IN (0, 1)),
    cue           TEXT NOT NULL
  );

  CREATE TABLE programs (
    id            INTEGER PRIMARY KEY,
    slug          TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    goal          TEXT NOT NULL CHECK (goal IN ('beginner', 'hypertrophy', 'strength', 'fat_loss')),
    level         TEXT NOT NULL CHECK (level IN ('beginner', 'intermediate', 'advanced')),
    days_per_week INTEGER NOT NULL CHECK (days_per_week BETWEEN 1 AND 7),
    weeks         INTEGER NOT NULL CHECK (weeks BETWEEN 1 AND 52),
    description   TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    modified_at   TEXT NOT NULL
  );

  CREATE TABLE program_days (
    id         INTEGER PRIMARY KEY,
    program_id INTEGER NOT NULL REFERENCES programs(id),
    day_index  INTEGER NOT NULL CHECK (day_index >= 1),
    name       TEXT NOT NULL,
    focus      TEXT NOT NULL,
    UNIQUE (program_id, day_index)
  );

  CREATE TABLE program_items (
    id              INTEGER PRIMARY KEY,
    program_day_id  INTEGER NOT NULL REFERENCES program_days(id),
    exercise_id     INTEGER NOT NULL REFERENCES exercises(id),
    sort_order      INTEGER NOT NULL,
    target_sets     INTEGER NOT NULL CHECK (target_sets BETWEEN 1 AND 10),
    rep_min         INTEGER NOT NULL CHECK (rep_min >= 1),
    rep_max         INTEGER NOT NULL CHECK (rep_max >= rep_min AND rep_max <= 50),
    rest_sec        INTEGER NOT NULL CHECK (rest_sec BETWEEN 15 AND 600),
    start_weight_kg REAL CHECK (start_weight_kg IS NULL OR start_weight_kg >= 0),
    UNIQUE (program_day_id, sort_order)
  );

  CREATE TABLE member_programs (
    id             INTEGER PRIMARY KEY,
    member_id      INTEGER NOT NULL REFERENCES members(id),
    program_id     INTEGER NOT NULL REFERENCES programs(id),
    next_day_index INTEGER NOT NULL DEFAULT 1 CHECK (next_day_index >= 1),
    started_at     TEXT NOT NULL,
    ended_at       TEXT,
    created_at     TEXT NOT NULL,
    modified_at    TEXT NOT NULL
  );
  -- At most one running programme per member.
  CREATE UNIQUE INDEX idx_member_programs_active ON member_programs(member_id) WHERE ended_at IS NULL;

  CREATE TABLE workouts (
    id                INTEGER PRIMARY KEY,
    member_id         INTEGER NOT NULL REFERENCES members(id),
    member_program_id INTEGER NOT NULL REFERENCES member_programs(id),
    program_day_id    INTEGER NOT NULL REFERENCES program_days(id),
    status            TEXT NOT NULL CHECK (status IN ('active', 'done')),
    started_at        TEXT NOT NULL,
    finished_at       TEXT,
    CHECK ((status = 'done') = (finished_at IS NOT NULL))
  );
  -- At most one workout in progress per member.
  CREATE UNIQUE INDEX idx_workouts_active ON workouts(member_id) WHERE status = 'active';
  CREATE INDEX idx_workouts_member ON workouts(member_id, finished_at);

  CREATE TABLE workout_sets (
    id              INTEGER PRIMARY KEY,
    workout_id      INTEGER NOT NULL REFERENCES workouts(id),
    program_item_id INTEGER NOT NULL REFERENCES program_items(id),
    exercise_id     INTEGER NOT NULL REFERENCES exercises(id),
    set_no          INTEGER NOT NULL CHECK (set_no >= 1),
    weight_kg       REAL CHECK (weight_kg IS NULL OR weight_kg BETWEEN 0 AND 500),
    reps            INTEGER NOT NULL CHECK (reps BETWEEN 0 AND 100),
    rpe             REAL CHECK (rpe IS NULL OR rpe BETWEEN 5 AND 10),
    created_at      TEXT NOT NULL,
    modified_at     TEXT NOT NULL,
    UNIQUE (workout_id, program_item_id, set_no)
  );
  CREATE INDEX idx_workout_sets_exercise ON workout_sets(exercise_id, workout_id);
  `,

  // 3: buddy radar (spotter posts, requests, short chats between matched members)
  `
  CREATE TABLE spotter_posts (
    id           INTEGER PRIMARY KEY,
    member_id    INTEGER NOT NULL REFERENCES members(id),
    muscle_group TEXT NOT NULL CHECK (muscle_group IN ('chest_back', 'shoulders_arms', 'legs', 'full_body')),
    location     TEXT NOT NULL CHECK (length(location) BETWEEN 2 AND 40),
    note         TEXT NOT NULL CHECK (length(note) <= 140),
    created_at   TEXT NOT NULL,
    closed_at    TEXT
  );
  -- One open post per member.
  CREATE UNIQUE INDEX idx_spotter_posts_open ON spotter_posts(member_id) WHERE closed_at IS NULL;
  CREATE INDEX idx_spotter_posts_created ON spotter_posts(created_at);

  CREATE TABLE spot_requests (
    id             INTEGER PRIMARY KEY,
    post_id        INTEGER NOT NULL REFERENCES spotter_posts(id),
    from_member_id INTEGER NOT NULL REFERENCES members(id),
    status         TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
    created_at     TEXT NOT NULL,
    modified_at    TEXT NOT NULL
  );
  -- A member asks a post at most once while the request is live.
  CREATE UNIQUE INDEX idx_spot_requests_live ON spot_requests(post_id, from_member_id) WHERE status IN ('pending', 'accepted');
  CREATE INDEX idx_spot_requests_from ON spot_requests(from_member_id, status);

  CREATE TABLE spot_messages (
    id               INTEGER PRIMARY KEY,
    request_id       INTEGER NOT NULL REFERENCES spot_requests(id),
    sender_member_id INTEGER NOT NULL REFERENCES members(id),
    body             TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 280),
    created_at       TEXT NOT NULL
  );
  CREATE INDEX idx_spot_messages_request ON spot_messages(request_id, id);
  `,
];
