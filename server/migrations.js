const db = require('./db')

const migrations = [
  {
    version: 1,
    name: 'initial_schema',
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          email         TEXT    NOT NULL UNIQUE,
          name          TEXT    NOT NULL,
          password_hash TEXT    NOT NULL,
          last_seen_at  INTEGER NOT NULL DEFAULT (unixepoch()),
          created_at    INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS groups (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          name        TEXT    NOT NULL,
          description TEXT    NOT NULL DEFAULT '',
          join_code   TEXT    NOT NULL UNIQUE,
          owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS group_members (
          group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
          user_id   INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
          joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (group_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS friendships (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status       TEXT    NOT NULL DEFAULT 'pending',
          created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE (requester_id, addressee_id)
        );
        CREATE TABLE IF NOT EXISTS group_invites (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id   INTEGER NOT NULL REFERENCES groups(id)  ON DELETE CASCADE,
          inviter_id INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
          invitee_id INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
          status     TEXT    NOT NULL DEFAULT 'pending',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE (group_id, invitee_id)
        );
        CREATE TABLE IF NOT EXISTS games (
          id                INTEGER PRIMARY KEY AUTOINCREMENT,
          name              TEXT    NOT NULL,
          category          TEXT    NOT NULL,
          specific_game     TEXT    NOT NULL,
          player_count      TEXT    NOT NULL,
          round_count       TEXT    NOT NULL,
          scoring_system    TEXT    NOT NULL DEFAULT '',
          rules             TEXT    NOT NULL,
          source            TEXT    NOT NULL DEFAULT 'community' CHECK (source IN ('official', 'community')),
          moderation_status TEXT    NOT NULL DEFAULT 'approved' CHECK (moderation_status IN ('approved', 'pending', 'rejected')),
          created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE (name, specific_game, source)
        );
        CREATE TABLE IF NOT EXISTS group_saved_games (
          group_id    INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
          game_id     INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
          saved_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (group_id, game_id)
        );
        CREATE TABLE IF NOT EXISTS group_game_sessions (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id       INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
          game_id        INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
          created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
          scheduled_for  INTEGER,
          status         TEXT    NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
          rule_overrides TEXT    NOT NULL DEFAULT '',
          created_at     INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS group_game_session_scores (
          session_id  INTEGER NOT NULL REFERENCES group_game_sessions(id) ON DELETE CASCADE,
          user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          score       INTEGER NOT NULL DEFAULT 0,
          updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (session_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS featured_clips (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          game_id     INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
          group_id    INTEGER REFERENCES groups(id) ON DELETE SET NULL,
          title       TEXT    NOT NULL,
          description TEXT    NOT NULL DEFAULT '',
          video_url   TEXT    NOT NULL UNIQUE,
          tags        TEXT    NOT NULL DEFAULT '[]',
          likes       INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0),
          uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `)
    },
  },
  {
    version: 2,
    name: 'add_scoring_system',
    up(database) {
      const cols = database.prepare('PRAGMA table_info(games)').all()
      if (!cols.some((c) => c.name === 'scoring_system')) {
        database.exec("ALTER TABLE games ADD COLUMN scoring_system TEXT NOT NULL DEFAULT ''")
      }
    },
  },
  {
    version: 3,
    name: 'add_last_seen_at',
    up(database) {
      const cols = database.prepare('PRAGMA table_info(users)').all()
      if (!cols.some((c) => c.name === 'last_seen_at')) {
        database.exec('ALTER TABLE users ADD COLUMN last_seen_at INTEGER NOT NULL DEFAULT 0')
        database.exec('UPDATE users SET last_seen_at = created_at WHERE last_seen_at IS NULL OR last_seen_at = 0')
      }
    },
  },
  {
    version: 4,
    name: 'tournament_tables',
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS tournaments (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id    INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
          name        TEXT    NOT NULL,
          type        TEXT    NOT NULL CHECK (type IN ('single_elimination', 'double_elimination', 'round_robin')),
          status      TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
          created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE TABLE IF NOT EXISTS tournament_participants (
          tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
          user_id       INTEGER NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
          seed          INTEGER,
          PRIMARY KEY (tournament_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS tournament_matches (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
          round         INTEGER NOT NULL,
          match_number  INTEGER NOT NULL,
          bracket_side  TEXT    NOT NULL DEFAULT 'winners' CHECK (bracket_side IN ('winners', 'losers', 'final')),
          player1_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
          player2_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
          winner_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
          score1        INTEGER,
          score2        INTEGER,
          status        TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'bye', 'active', 'completed')),
          next_match_id INTEGER REFERENCES tournament_matches(id),
          loser_next_match_id INTEGER REFERENCES tournament_matches(id),
          created_at    INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `)
    },
  },
]

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT    NOT NULL,
      applied_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  const applied = new Set(
    db.prepare('SELECT version FROM _migrations').all().map((r) => r.version)
  )

  const insert = db.prepare('INSERT INTO _migrations (version, name) VALUES (?, ?)')

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue

    db.transaction(() => {
      migration.up(db)
      insert.run(migration.version, migration.name)
    })()

    console.log(`[migrations] applied v${migration.version}: ${migration.name}`)
  }
}

module.exports = { runMigrations }
