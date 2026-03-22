import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { BlackjackGame } from './game';
import { PlaceBetRequest, ActionRequest, GameResponse, GameState } from '../../shared/types';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── HTTP + WebSocket on the same port ────────────────────────────────────────
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

// Store active games and WS connections by session
const games      = new Map<string, BlackjackGame>();
const wsSessions = new Map<string, WebSocket>();

function getOrCreateGame(sessionId: string): BlackjackGame {
  if (!games.has(sessionId)) {
    games.set(sessionId, new BlackjackGame());
  }
  return games.get(sessionId)!;
}

// Track WebSocket connections by sessionId (passed as query param)
wss.on('connection', (ws, req) => {
  const sid = new URL(req.url ?? '', 'http://localhost').searchParams.get('sessionId') ?? '';
  if (sid) {
    wsSessions.set(sid, ws);
    ws.on('close', () => wsSessions.delete(sid));
  }
});

function emitState(sid: string, state: GameState): void {
  const ws = wsSessions.get(sid);
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'state', state }));
  }
}

// ── REST routes ──────────────────────────────────────────────────────────────

// Get current game state
app.get('/api/game/:sessionId', (req, res) => {
  const game = getOrCreateGame(req.params.sessionId);
  const response: GameResponse = { success: true, state: game.getState() };
  res.json(response);
});

// Start new game / reset
app.post('/api/game/:sessionId/new', (req, res) => {
  const game  = getOrCreateGame(req.params.sessionId);
  const state = game.newRound();
  res.json({ success: true, state });
});

// Place bet
app.post('/api/game/:sessionId/bet', (req, res) => {
  const game      = getOrCreateGame(req.params.sessionId);
  const { bet }   = req.body as PlaceBetRequest;

  if (!bet || typeof bet !== 'number') {
    res.json({ success: false, state: game.getState(), error: 'Invalid bet' });
    return;
  }

  const state = game.placeBet(bet);
  res.json({ success: true, state });
});

// Player action — if it triggers dealer turn, drive it via WS or sync fallback
app.post('/api/game/:sessionId/action', (req, res) => {
  const { sessionId } = req.params;
  const game          = getOrCreateGame(sessionId);
  const { action }    = req.body as ActionRequest;

  let state: GameState;
  switch (action) {
    case 'hit':    state = game.hit();    break;
    case 'stand':  state = game.stand();  break;
    case 'double': state = game.double(); break;
    case 'split':  state = game.split();  break;
    default:
      res.json({ success: false, state: game.getState(), error: 'Invalid action' });
      return;
  }

  if (state.phase === 'dealer_turn') {
    const ws = wsSessions.get(sessionId);
    if (ws?.readyState === WebSocket.OPEN) {
      // Return dealer_turn state immediately (hole card visible), then push each
      // dealer card step-by-step over WebSocket for client-side animation.
      res.json({ success: true, state });
      game.runDealerPlay(s => emitState(sessionId, s)).catch(console.error);
      return;
    }
    // No WS connected — play dealer synchronously and return resolved state
    game.playDealerSync();
    state = game.getState();
  }

  res.json({ success: true, state });
});

// New round (after resolved)
app.post('/api/game/:sessionId/round', (req, res) => {
  const game  = getOrCreateGame(req.params.sessionId);
  const state = game.newRound();
  res.json({ success: true, state });
});

// ── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Blackjack server running on http://localhost:${PORT}`);
});
