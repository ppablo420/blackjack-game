import { GameResponse } from '../../shared/types';

const API_BASE = 'http://localhost:3001/api/game';

let sessionId: string = localStorage.getItem('blackjack_session') || generateSessionId();

function generateSessionId(): string {
  const id = 'session_' + Math.random().toString(36).substring(2, 15);
  localStorage.setItem('blackjack_session', id);
  return id;
}

async function request(endpoint: string, method: string = 'GET', body?: any): Promise<GameResponse> {
  const url = `${API_BASE}/${sessionId}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  return response.json();
}

export const api = {
  getState: () => request('', 'GET'),
  placeBet: (bet: number) => request('/bet', 'POST', { bet }),
  hit: () => request('/action', 'POST', { action: 'hit' }),
  stand: () => request('/action', 'POST', { action: 'stand' }),
  double: () => request('/action', 'POST', { action: 'double' }),
  split: () => request('/action', 'POST', { action: 'split' }),
  newRound: () => request('/round', 'POST'),
};
