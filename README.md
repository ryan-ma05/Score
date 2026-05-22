# Score

Score is a full-stack game-group app built with React, TypeScript, Vite, Express, Socket.IO, and SQLite.
It supports account auth, friends, group management, reusable game templates, playable group sessions, live score updates, searchable game catalogs, and featured video clips tied to games.

## Tech Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS, React Router
- Backend: Express 5, Socket.IO, Multer
- Auth: JWT + bcrypt
- Database: SQLite via `better-sqlite3`
- Storage: local disk uploads in `/uploads`

## Current Product Features

- JWT-based authentication with sign up, sign in, persisted sessions, and protected API routes
- Rate-limited auth endpoints to slow down brute-force login/register attempts
- Top-tab navigation for `Create`, `Featured`, `Home`, `Search`, and `Friends`
- Home dashboard with:
  - `Groups you run`
  - `Groups joined`
  - `Notifications`
  - direct deep-link opening of a group workspace from `#group-<id>`
- Group creation and join-by-code flows
- Group invites that can be accepted or declined
- Group owner controls:
  - invite friends into the group
  - share/copy join codes
  - remove members
  - transfer ownership
- Game catalog creation with moderation-style validation
- Searchable game library with category filtering
- Group game template workflow:
  - save approved catalog games into a group
  - create custom group templates that are also published into the catalog
- Group session workflow:
  - create a session from a saved template
  - optional scheduling
  - status tracking for `scheduled`, `completed`, and `cancelled`
  - rule overrides per session
- Editable group scoreboards with:
  - `+1` and `-1` controls
  - direct exact score entry
  - seeded score rows for all group members
  - live Socket.IO score sync for open viewers
- Group leaderboard across completed sessions
- Local video upload flow for featured clips
- Featured feed with:
  - clip creation
  - pagination
  - filtering by game
  - text search
  - sorting by likes or recency
- Friends system with:
  - search by name
  - send request
  - accept/decline request
  - outgoing request tracking
  - unfriend
- Presence tracking using `last_seen_at` so groups can show `online/total` member counts
- SQLite migrations and official game seeding at server startup

## Running The App

1. Install dependencies:

```bash
npm install
```

2. Start frontend and backend together:

```bash
npm run dev
```

3. Open:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

Additional commands:

```bash
npm run build
npm run server
npm run server:dev
npm run preview
```

## Environment Variables

These are optional in development unless noted otherwise:

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | Express server port | `3001` |
| `JWT_SECRET` | JWT signing secret. Required in production. | `dev-secret-change-me` in development |
| `CORS_ORIGIN` | Comma-separated allowed origins for the API and Socket.IO server | `http://localhost:5173,http://localhost:4173` |

## Frontend Architecture

### App Shell

| File | Purpose |
| --- | --- |
| `src/App.tsx` | Auth gate, top-level routing, shared game catalog loading, authenticated shell, tab navigation container |
| `src/main.tsx` | React bootstrap with `StrictMode` |
| `src/components/navigation/TopTabs.tsx` | Router-backed top navigation tabs |

### Routed Pages

| File | Purpose | Status |
| --- | --- | --- |
| `src/pages/Home.tsx` | Main authenticated landing page with owned/joined group dropdown cards, notifications, group workspace launcher, create/join modals | Active |
| `src/pages/Create.tsx` | Create and submit games into the shared catalog, with recent-games sidebar | Active |
| `src/pages/Featured.tsx` | Upload videos, create featured clips, browse/filter/paginate featured feed | Active |
| `src/pages/Search.tsx` | Search and filter the game catalog | Active |
| `src/pages/Friends.tsx` | Full friends management screen using direct API calls | Active |
| `src/pages/SignIn.tsx` | Sign-in screen | Active when signed out |
| `src/pages/SignUp.tsx` | Registration screen | Active when signed out |
| `src/pages/Dashboard.tsx` | Older alternate dashboard using tabbed groups/friends layout | Retained, not used by current router |

### Context Providers

| File | Purpose |
| --- | --- |
| `src/context/AuthContext.tsx` | Stores the signed-in user, bootstraps `/api/auth/me`, handles login/register/logout, persists JWT in `localStorage` |
| `src/context/FriendContext.tsx` | Manages friend lists, incoming/outgoing requests, search results, request actions, and pagination |
| `src/context/GroupContext.tsx` | Manages groups, group invites, group details, saved templates, sessions, ownership actions, and score updates |

### Shared Libraries

| File | Purpose |
| --- | --- |
| `src/lib/api.ts` | Shared authenticated fetch wrapper and `ApiError` handling |
| `src/lib/content.ts` | Shared domain types, game categories, sort helpers, and frontend validation for games/clips |
| `src/lib/contentApi.ts` | Frontend API client for games, featured clips, and file uploads |
| `src/lib/socket.ts` | Shared Socket.IO client singleton plus session room join/leave helpers |

### Group Components

| File | Purpose | Status |
| --- | --- | --- |
| `src/components/groups/CreateGroupModal.tsx` | Create-group modal | Active |
| `src/components/groups/JoinGroupModal.tsx` | Join-by-code modal | Active |
| `src/components/groups/GroupInvites.tsx` | Displays pending group invites with accept/decline actions | Active |
| `src/components/groups/GroupDetailModal.tsx` | Main group workspace modal that composes roster, templates, sessions, live scores, and leaderboard | Active |
| `src/components/groups/GroupList.tsx` | Card list for group browsing with manage/view button | Retained as supporting component |
| `src/components/groups/GroupPlanningBoard.tsx` | Planning summary for templates and sessions across groups | Retained, not mounted from current Home route |
| `src/components/groups/groupDetailUtils.ts` | Group workspace helpers for sorting, scoreboards, date formatting, and shared input classes | Active |

#### Group Workspace Panels

| File | Purpose |
| --- | --- |
| `src/components/groups/panels/GroupRosterPanel.tsx` | Member roster, join-code sharing, friend invites, owner transfer, leave/remove actions |
| `src/components/groups/panels/GroupGamesPanel.tsx` | Save catalog games into a group and create custom reusable templates |
| `src/components/groups/panels/GroupSessionsPanel.tsx` | Create sessions, optionally schedule them, display scoreboards, and edit scores |
| `src/components/groups/panels/GroupLeaderboardPanel.tsx` | Aggregate completed-session leaderboard with rank, totals, average, and wins |
| `src/components/groups/panels/GameTimer.tsx` | Countdown timer with presets for group play |
| `src/components/groups/panels/shared.tsx` | Shared UI primitives used by the group workspace panels |

### Friends Components

| File | Purpose | Status |
| --- | --- | --- |
| `src/components/friends/FriendsList.tsx` | Older friends list wrapper using `FriendContext` | Retained as alternate/supporting UI |
| `src/components/friends/FriendRequests.tsx` | Pending incoming friend request list | Retained as alternate/supporting UI |
| `src/components/friends/SearchUsersModal.tsx` | Modal for user search and friend requests | Retained as alternate/supporting UI |

## Backend Architecture

### Server Core

| File | Purpose |
| --- | --- |
| `server/index.js` | Express app setup, CORS, JSON parsing, Socket.IO setup, migrations, seeding, static uploads, route registration |
| `server/auth.js` | Password hashing, password verification, JWT signing, JWT verification |
| `server/middleware.js` | Auth middleware and presence timestamp updates |
| `server/db.js` | SQLite connection, schema creation, indexes, and cleanup of legacy example rows |
| `server/migrations.js` | Versioned schema migrations stored in `_migrations` |
| `server/seed.js` | Seeds official games into the catalog |
| `server/package.json` | Marks the backend folder as CommonJS |

### API Routes

| File | Route Base | Purpose |
| --- | --- | --- |
| `server/routes/authRoutes.js` | `/api/auth` | Register, login, and current-user lookup |
| `server/routes/gameRoutes.js` | `/api/games` | List approved games and create community games |
| `server/routes/clipRoutes.js` | `/api/featured-clips` | List clips, create clips, and like clips |
| `server/routes/groupRoutes.js` | `/api/groups` | Group CRUD-style membership flows, invites, saved templates, sessions, scores, leaderboard, ownership controls |
| `server/routes/friendRoutes.js` | `/api/friends` | Friends list, requests, search, send, accept, decline, and delete |
| `server/routes/uploadRoutes.js` | `/api/upload` | Local video uploads using Multer |

### Database Tables

| Table | Purpose |
| --- | --- |
| `users` | User records, password hashes, presence timestamps |
| `groups` | Group records, owner, join code |
| `group_members` | Membership join table |
| `friendships` | Pending and accepted friend relationships |
| `group_invites` | Owner-to-user group invitations |
| `games` | Shared game catalog with moderation/source metadata |
| `group_saved_games` | Group-level saved game templates |
| `group_game_sessions` | Actual scheduled or logged group play sessions |
| `group_game_session_scores` | Per-member score rows for each session |
| `featured_clips` | Featured video clips tied to a game and optionally a group |
| `_migrations` | Tracks applied schema migrations |

## Real-Time, Uploads, And Data Flow

- Socket.IO rooms use `session:<id>` so open group viewers can receive live score changes
- Uploads are written to the local `/uploads` directory and served back from `/uploads/*`
- Vite proxies `/api`, `/uploads`, and `/socket.io` to `http://localhost:3001`
- Auth tokens are stored in `localStorage` under `auth_token`
- SQLite data lives in `server/data/score.db`

## Notable Domain Model Decisions

- A game template is separate from a specific group session
- `games` contains reusable catalog entries
- `group_saved_games` bookmarks a reusable game for a specific group
- `group_game_sessions` creates an actual event instance from a saved template
- `featured_clips` can attach to a `game_id` and optionally a `group_id`
- Scores are numeric and stored per session per member
- Session scheduling is optional

## Repo Notes

- `server/seed.js` intentionally seeds official starter games for a baseline catalog
- `server/db.js` also removes older hardcoded example rows from earlier iterations
- The current app uses router-backed top tabs, but a few earlier/alternate components are still retained in the repo for reference or future reuse

