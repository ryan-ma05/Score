const Database = require('better-sqlite3')
const path = require('path')

const db = new Database(path.join(__dirname, 'data', 'score.db'))

db.pragma('foreign_keys = ON')
db.pragma('journal_mode = WAL')

db.exec(`
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

  CREATE INDEX IF NOT EXISTS idx_games_category_status
    ON games (category, moderation_status);

  CREATE INDEX IF NOT EXISTS idx_group_saved_games_group
    ON group_saved_games (group_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_group_game_sessions_group
    ON group_game_sessions (group_id, status, scheduled_for DESC);

  CREATE INDEX IF NOT EXISTS idx_group_game_session_scores_session
    ON group_game_session_scores (session_id, updated_at DESC);

  CREATE INDEX IF NOT EXISTS idx_featured_clips_game
    ON featured_clips (game_id, likes DESC, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_featured_clips_group
    ON featured_clips (group_id, created_at DESC);
`)

const LEGACY_EXAMPLE_GAMES = [
  {
    name: 'Poker Night',
    specificGame: 'Texas Hold’em',
  },
  {
    name: 'Backyard Cup Pong',
    specificGame: 'Cup Pong',
  },
  {
    name: 'Hearts Classic',
    specificGame: 'Hearts',
  },
]

const LEGACY_EXAMPLE_CLIP_URLS = [
  'https://example.com/clips/cup-pong-comeback',
  'https://example.com/clips/hearts-shoot-the-moon',
]

removeLegacyExampleContent()

module.exports = db

function removeLegacyExampleContent() {
  const deleteClip = db.prepare(`
    DELETE FROM featured_clips
    WHERE video_url = ?
  `)

  const deleteGame = db.prepare(`
    DELETE FROM games
    WHERE name = ? AND specific_game = ? AND source = 'official'
  `)

  const cleanup = db.transaction(() => {
    for (const videoUrl of LEGACY_EXAMPLE_CLIP_URLS) {
      deleteClip.run(videoUrl)
    }

    for (const game of LEGACY_EXAMPLE_GAMES) {
      deleteGame.run(game.name, game.specificGame)
    }
  })

  cleanup()
}

function ensureColumn(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all()
  const exists = columns.some((column) => column.name === columnName)

  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
  }
}
