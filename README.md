# Blackjack — Yoni Casino

**Blackjack – Yoni Casino** is a full-stack browser-based blackjack game built with Phaser 3 and Express.js (TypeScript). Features animated card dealing, chip-based betting ($5–$100), and all major actions — Hit, Stand, Double Down & Split. All game logic runs server-side on a 6-deck shoe. No image assets — everything is drawn with Phaser graphics primitives.

## How to Run

### Prerequisites
- Node.js 18+ and npm

### Quick Start

```bash
# From the project root — installs all workspace dependencies
npm install

# Run server and client concurrently
npm run dev
```

The server runs on `http://localhost:3001` and the client on `http://localhost:3000`.

Open `http://localhost:3000` in your browser to play.

### Run Individually

```bash
# Terminal 1 – Server
cd server && npm run dev

# Terminal 2 – Client
cd client && npm run dev
```

---

## Architecture

```
blackjack-game/
├── shared/          # Shared TypeScript types (Card, GameState, API types)
├── server/          # Express.js backend — all game logic lives here
│   └── src/
│       ├── index.ts    # REST API routes + session management
│       ├── game.ts     # BlackjackGame engine (rules, state, evaluation)
│       └── shoe.ts     # 6-deck shoe with Fisher-Yates shuffle
├── client/          # Phaser 3 frontend — rendering and input only
│   └── src/
│       ├── index.ts              # Phaser game config (1280×720, anti-aliased)
│       ├── api.ts                # HTTP client for server communication
│       ├── cardRenderer.ts       # Card graphics — ivory face, crimson/gold back
│       └── scenes/
│           └── BlackjackScene.ts # Main game scene with diff-based animation engine
└── package.json     # Root npm workspace with shared dev scripts
```

---

## Design Decisions

**Server is the single source of truth.** All game logic — hand evaluation, bust detection, dealer AI, win/loss calculation, and payout — runs exclusively on the server. The client renders whatever state it receives and sends player actions via REST. It never calculates outcomes.

**6-deck shoe with auto-reshuffle.** The shoe contains 312 cards (6 × 52). Fisher-Yates shuffle ensures uniform randomness. The shoe reshuffles automatically when ~75% has been dealt, matching real casino practice.

**REST over WebSocket.** Blackjack is turn-based. A request-response model is simpler, easier to reason about, and sufficient for single-player play.

**Diff-based animation engine.** Rather than destroying and re-rendering everything on each state update, `BlackjackScene` maintains a `cardMap` keyed by card position (`d0`, `p0_1`, etc.). On each state change it computes which cards are new (animate deal from shoe), which flipped face-up (animate flip), and which need repositioning (tween). This gives smooth, continuous animations without state explosions.

**Graphics-only rendering.** Cards, chips, the dealer character, and the table are all drawn with Phaser `Graphics` and `Text` primitives — no external image assets required. This makes the project completely self-contained.

**Session-based in-memory storage.** Games are keyed by a `sessionId` stored in `localStorage`. Simple for an MVP; easily swapped for Redis or a database.

---

## Game Rules Implemented

| Rule | Detail |
|------|--------|
| Deck | 6-deck shoe (312 cards), reshuffle at ~75% dealt |
| Card values | 2–10 = face value, J/Q/K = 10, Ace = 1 or 11 |
| Natural blackjack | First two cards = 21, pays **3:2** |
| Bust | Exceeds 21 — immediate loss |
| Push | Player and dealer tie — bet returned |
| Dealer rule | Hits on **soft 17**, stands on hard 17+ |
| Double Down | 2-card hand only — doubles bet, receives exactly one card |
| Split | Matching-value pairs — up to 4 hands; split Aces receive one card each |

---

## What Works

- Complete game loop: place bet → deal → play all actions → dealer resolves → new round
- All four player actions: **Hit, Stand, Double Down, Split**
- Dealer correctly follows the soft-17 rule
- Animated card dealing (slides from shoe), card flip (dealer hole card reveal), and result pop-in
- Chip-based bet selection ($5 / $10 / $25 / $50 / $100)
- Multiple split hands played independently with per-hand bet tracking
- Balance updates correctly for wins, losses, pushes, doubles, and splits
- Clear win / lose / push / blackjack result labels per hand
- Shoe card counter updates in real time
- Session persists across page refreshes (localStorage)

## What I Would Improve With More Time

- **Sound effects** — card dealing, chip placement, win/loss audio cues
- **Persistent storage** — save session state to a database (Redis / SQLite) so balance survives server restarts
- **Insurance & Surrender** — complete the standard blackjack action set
- **Unit tests** — automated tests for server-side game logic edge cases (split Aces, soft-17 chains, multi-hand resolution)
- **Mobile layout** — responsive scaling and touch-friendly controls
- **WebSocket upgrade** — for future multiplayer or live dealer extensions
- **Betting history** — per-session profit/loss tracker

---

## Changelog

### v1.0 — Initial Build
The first working version established the full project architecture:

- Full-stack setup with **npm workspaces** (client / server / shared)
- **Express.js** REST API handling all game logic server-side
- **Phaser 3** client rendering the game state received from the server
- Complete blackjack engine: Hit, Stand, Double Down, Split (up to 4 hands)
- 6-deck shoe with Fisher-Yates shuffle and auto-reshuffle at 75%
- Animated card dealing — cards slide in from the shoe position
- Dealer hole card flip animation on reveal
- Chip-based betting UI ($5 / $10 / $25 / $50 / $100)
- Balance tracking with correct payouts (3:2 for blackjack)
- Session persistence via `localStorage`
- Diff-based animation engine — only changed cards are re-rendered, avoiding flicker

### v1.1 — Visual Polish & Chip Animations
Focused on making the game feel more alive and polished:

- **Table redesign** — switched from dark navy/gold theme to dark crimson felt with maple wood border
- **Chip throw animation** — chip flies from the bet row to the table center when placing a bet
- **Chip scrape animation** — chips slide toward the player on win, or toward the dealer on loss
- **Card rendering fix** — corrected bottom-right rank and suit position (origin + rotation was misaligned)
- **Split stability fix** — added card identity check to correctly handle card replacement after a split
- **TypeScript config fix** — corrected `rootDir` in server `tsconfig.json` for shared type resolution

### Planned — Next Improvements
Features currently being considered for upcoming versions:

- Sound effects (deal, flip, win, lose, chip click)
- Insurance & Surrender actions
- Persistent balance storage (survive server restarts)
- Betting history / session stats panel
- Mobile-responsive layout
- Unit tests for server game logic
