import { Card, Suit, Rank } from '../../shared/types';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const NUM_DECKS = 6;
const RESHUFFLE_THRESHOLD = 0.75; // reshuffle when 75% dealt

export class Shoe {
  private cards: Card[] = [];
  private totalCards: number;
  private reshufflePoint: number;

  /**
   * @param predefinedCards Optional list of cards dealt in order (index 0 = first dealt).
   *   Used for deterministic testing. When omitted, a real 6-deck shoe is shuffled.
   */
  constructor(predefinedCards?: Card[]) {
    if (predefinedCards) {
      // Reverse so Array.pop() yields them in the given order
      this.cards = [...predefinedCards].reverse();
      this.totalCards = predefinedCards.length;
    } else {
      this.totalCards = NUM_DECKS * 52;
      this.shuffle();
    }
    this.reshufflePoint = Math.floor(this.totalCards * RESHUFFLE_THRESHOLD);
  }

  shuffle(): void {
    this.cards = [];
    for (let d = 0; d < NUM_DECKS; d++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          this.cards.push({ suit, rank, faceUp: true });
        }
      }
    }
    // Fisher-Yates shuffle
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal(faceUp: boolean = true): Card {
    if (this.cards.length === 0) {
      this.shuffle();
    }
    const card = this.cards.pop()!;
    card.faceUp = faceUp;
    return card;
  }

  needsReshuffle(): boolean {
    const dealt = this.totalCards - this.cards.length;
    return dealt >= this.reshufflePoint;
  }

  get remaining(): number {
    return this.cards.length;
  }

  get size(): number {
    return this.totalCards;
  }
}
