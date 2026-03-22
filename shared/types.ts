// Shared types for blackjack game

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
}

export interface Hand {
  cards: Card[];
  value: number;
  soft: boolean; // whether the hand has an ace counted as 11
  busted: boolean;
  blackjack: boolean;
}

export type GamePhase = 'betting' | 'playing' | 'dealer_turn' | 'resolved';
export type HandResult = 'win' | 'lose' | 'push' | 'blackjack' | 'pending';

export interface PlayerHand extends Hand {
  bet: number;
  result: HandResult;
  doubled: boolean;
  stood: boolean;
}

export interface DealerHand extends Hand {
  // dealer's first card may be hidden
}

export interface GameState {
  id: string;
  phase: GamePhase;
  playerHands: PlayerHand[];
  activeHandIndex: number;
  dealerHand: DealerHand;
  balance: number;
  currentBet: number;
  shoeSize: number;       // total cards in shoe
  cardsRemaining: number; // cards left in shoe
  message: string;
}

// API types
export interface PlaceBetRequest {
  bet: number;
}

export interface ActionRequest {
  action: 'hit' | 'stand' | 'double' | 'split';
  handIndex?: number;
}

export interface GameResponse {
  success: boolean;
  state: GameState;
  error?: string;
}
