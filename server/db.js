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

const OFFICIAL_GAMES = [
  {
    name: 'Poker Night',
    category: 'Card game',
    specificGame: 'Texas Hold’em',
    playerCount: '2-8',
    roundCount: '5+ hands',
    scoringSystem: 'Highest chip count at the agreed stopping point wins. Blinds and payouts determine score swings.',
    rules: 'Players bet, call, raise, or fold as shared and private cards build the best hand.',
  },
  {
    name: 'Backyard Cup Pong',
    category: 'Drinking game',
    specificGame: 'Cup Pong',
    playerCount: '2-4',
    roundCount: '10 cups per side',
    scoringSystem: 'Higher score wins. Add 1 point per cup made and subtract cups hit against your side.',
    rules: 'Teams alternate shots, remove cups that are hit, and finish with redemption rules.',
  },
  {
    name: 'Hearts Classic',
    category: 'Card game',
    specificGame: 'Hearts',
    playerCount: '4',
    roundCount: 'Until 100 points',
    scoringSystem: 'Lowest score wins. Add penalty points each hand, unless a player shoots the moon.',
    rules: 'Avoid hearts and the queen of spades, unless you manage to shoot the moon.',
  },
]

ensureColumn('games', 'scoring_system', "TEXT NOT NULL DEFAULT ''")

const OFFICIAL_CLIPS = [
  {
    gameKey: 'Cup Pong',
    title: 'Last-cup comeback',
    description: 'A fast comeback clip from the final round.',
    videoUrl: 'https://example.com/clips/cup-pong-comeback',
    tags: ['cup pong', 'clutch', 'featured'],
    likes: 218,
  },
  {
    gameKey: 'Hearts',
    title: 'Shooting the moon',
    description: 'A clean example of turning a risky hand into a big swing.',
    videoUrl: 'https://example.com/clips/hearts-shoot-the-moon',
    tags: ['hearts', 'cards', 'strategy'],
    likes: 153,
  },
]

seedContent()

module.exports = db

function seedContent() {
  const insertGame = db.prepare(`
    INSERT OR IGNORE INTO games (
      name, category, specific_game, player_count, round_count, scoring_system, rules, source, moderation_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'official', 'approved')
  `)

  const updateGameScoring = db.prepare(`
    UPDATE games
    SET scoring_system = ?
    WHERE specific_game = ? AND source = 'official' AND (scoring_system IS NULL OR scoring_system = '')
  `)

  const insertClip = db.prepare(`
    INSERT OR IGNORE INTO featured_clips (
      game_id, title, description, video_url, tags, likes
    ) VALUES (?, ?, ?, ?, ?, ?)
  `)

  const findGameId = db.prepare(`
    SELECT id FROM games
    WHERE specific_game = ? AND source = 'official'
    LIMIT 1
  `)

  const seed = db.transaction(() => {
    for (const game of OFFICIAL_GAMES) {
      insertGame.run(
        game.name,
        game.category,
        game.specificGame,
        game.playerCount,
        game.roundCount,
        game.scoringSystem,
        game.rules,
      )

      updateGameScoring.run(game.scoringSystem, game.specificGame)
    }

    for (const clip of OFFICIAL_CLIPS) {
      const row = findGameId.get(clip.gameKey)
      if (!row) continue

      insertClip.run(
        row.id,
        clip.title,
        clip.description,
        clip.videoUrl,
        JSON.stringify(clip.tags),
        clip.likes,
      )
    }
  })

  seed()
}

function ensureColumn(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all()
  const exists = columns.some((column) => column.name === columnName)

  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
  }
}
