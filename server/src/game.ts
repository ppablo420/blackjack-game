import { v4 as uuidv4 } from 'uuid';
import {
  Card, Rank, Hand, PlayerHand, DealerHand,
  GameState, GamePhase, HandResult
} from '../../shared/types';
import { Shoe } from './shoe';

const STARTING_BALANCE = 1000;
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function cardValue(rank: Rank): number[] {
  if (rank === 'A') return [1, 11];
  if (['J', 'Q', 'K'].includes(rank)) return [10];
  return [parseInt(rank)];
}

function evaluateHand(cards: Card[]): { value: number; soft: boolean } {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.rank === 'A') {
      aces++;
      total += 11;
    } else {
      total += cardValue(card.rank)[0];
    }
  }

  // Convert aces from 11 to 1 as needed
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return { value: total, soft: aces > 0 };
}

function makeHand(cards: Card[]): Hand {
  const { value, soft } = evaluateHand(cards);
  return {
    cards,
    value,
    soft,
    busted: value > 21,
    blackjack: cards.length === 2 && value === 21,
  };
}

function makePlayerHand(cards: Card[], bet: number): PlayerHand {
  const hand = makeHand(cards);
  return {
    ...hand,
    bet,
    result: 'pending',
    doubled: false,
    stood: false,
  };
}

export class BlackjackGame {
  private shoe: Shoe;
  private id: string;
  private phase: GamePhase;
  private playerHands: PlayerHand[];
  private activeHandIndex: number;
  private dealerHand: DealerHand;
  private balance: number;
  private currentBet: number;
  private message: string;

  constructor(shoe?: Shoe) {
    this.shoe = shoe ?? new Shoe();
    this.id = uuidv4();
    this.phase = 'betting';
    this.playerHands = [];
    this.activeHandIndex = 0;
    this.dealerHand = { cards: [], value: 0, soft: false, busted: false, blackjack: false };
    this.balance = STARTING_BALANCE;
    this.currentBet = 0;
    this.message = 'Place your bet to begin.';
  }

  getState(): GameState {
    // Hide dealer's hole card if still playing
    let dealerHand = { ...this.dealerHand };
    if (this.phase === 'playing') {
      dealerHand = {
        ...dealerHand,
        cards: dealerHand.cards.map((c, i) =>
          i === 1 ? { ...c, faceUp: false } : c
        ),
        // Show only the face-up card value
        value: cardValue(dealerHand.cards[0].rank)[0] === 1 ? 11 : cardValue(dealerHand.cards[0].rank)[0],
        soft: dealerHand.cards[0].rank === 'A',
      };
    }

    return {
      id: this.id,
      phase: this.phase,
      playerHands: this.playerHands,
      activeHandIndex: this.activeHandIndex,
      dealerHand,
      balance: this.balance,
      currentBet: this.currentBet,
      shoeSize: this.shoe.size,
      cardsRemaining: this.shoe.remaining,
      message: this.message,
    };
  }

  placeBet(amount: number): GameState {
    if (this.phase !== 'betting') {
      this.message = 'Cannot place bet now.';
      return this.getState();
    }
    if (amount <= 0 || amount > this.balance) {
      this.message = 'Invalid bet amount.';
      return this.getState();
    }

    // Check if shoe needs reshuffle
    if (this.shoe.needsReshuffle()) {
      this.shoe.shuffle();
      this.message = 'Shoe reshuffled.';
    }

    this.currentBet = amount;
    this.balance -= amount;

    // Deal initial cards: player, dealer, player, dealer
    const playerCards = [this.shoe.deal(), this.shoe.deal()];
    const dealerCards = [this.shoe.deal(), this.shoe.deal()];

    this.playerHands = [makePlayerHand(playerCards, amount)];
    this.activeHandIndex = 0;

    const dEval = evaluateHand(dealerCards);
    this.dealerHand = {
      cards: dealerCards,
      value: dEval.value,
      soft: dEval.soft,
      busted: false,
      blackjack: dealerCards.length === 2 && dEval.value === 21,
    };

    // Check for natural blackjacks
    const playerBJ = this.playerHands[0].blackjack;
    const dealerBJ = this.dealerHand.blackjack;

    if (playerBJ && dealerBJ) {
      this.playerHands[0].result = 'push';
      this.balance += amount; // return bet
      this.phase = 'resolved';
      this.message = 'Both have Blackjack! Push.';
    } else if (playerBJ) {
      const payout = amount + Math.floor(amount * 1.5); // 3:2
      this.playerHands[0].result = 'blackjack';
      this.balance += payout;
      this.phase = 'resolved';
      this.message = `Blackjack! You win $${Math.floor(amount * 1.5)}!`;
    } else if (dealerBJ) {
      this.playerHands[0].result = 'lose';
      this.phase = 'resolved';
      this.message = 'Dealer has Blackjack. You lose.';
    } else {
      this.phase = 'playing';
      this.message = 'Your turn. Hit, Stand, Double Down' +
        (this.canSplit() ? ', or Split.' : '.');
    }

    return this.getState();
  }

  private canSplit(): boolean {
    if (this.playerHands.length >= 4) return false; // max 4 splits
    const hand = this.playerHands[this.activeHandIndex];
    if (hand.cards.length !== 2) return false;
    if (this.balance < hand.bet) return false; // need money to split
    const v1 = cardValue(hand.cards[0].rank)[0];
    const v2 = cardValue(hand.cards[1].rank)[0];
    return v1 === v2 || (hand.cards[0].rank === 'A' && hand.cards[1].rank === 'A');
  }

  private canDouble(): boolean {
    const hand = this.playerHands[this.activeHandIndex];
    return hand.cards.length === 2 && !hand.doubled && this.balance >= hand.bet;
  }

  hit(): GameState {
    if (this.phase !== 'playing') {
      this.message = 'Cannot hit now.';
      return this.getState();
    }

    const hand = this.playerHands[this.activeHandIndex];
    if (hand.stood || hand.busted) {
      this.message = 'This hand is already complete.';
      return this.getState();
    }

    const card = this.shoe.deal();
    hand.cards.push(card);
    const eval_ = evaluateHand(hand.cards);
    hand.value = eval_.value;
    hand.soft = eval_.soft;
    hand.busted = eval_.value > 21;

    if (hand.busted) {
      hand.result = 'lose';
      this.message = `Hand busted with ${hand.value}!`;
      this.advanceHand();
    } else if (hand.value === 21) {
      hand.stood = true;
      this.message = '21! Moving on.';
      this.advanceHand();
    } else {
      this.message = `Hand value: ${hand.value}. Hit or Stand?`;
    }

    return this.getState();
  }

  stand(): GameState {
    if (this.phase !== 'playing') {
      this.message = 'Cannot stand now.';
      return this.getState();
    }

    const hand = this.playerHands[this.activeHandIndex];
    hand.stood = true;
    this.message = `Standing on ${hand.value}.`;
    this.advanceHand();

    return this.getState();
  }

  double(): GameState {
    if (this.phase !== 'playing') {
      this.message = 'Cannot double now.';
      return this.getState();
    }

    if (!this.canDouble()) {
      this.message = 'Cannot double down on this hand.';
      return this.getState();
    }

    const hand = this.playerHands[this.activeHandIndex];
    this.balance -= hand.bet;
    hand.bet *= 2;
    hand.doubled = true;

    // Deal exactly one card
    const card = this.shoe.deal();
    hand.cards.push(card);
    const eval_ = evaluateHand(hand.cards);
    hand.value = eval_.value;
    hand.soft = eval_.soft;
    hand.busted = eval_.value > 21;

    if (hand.busted) {
      hand.result = 'lose';
      this.message = `Doubled and busted with ${hand.value}!`;
    } else {
      hand.stood = true;
      this.message = `Doubled down. Hand value: ${hand.value}.`;
    }

    this.advanceHand();
    return this.getState();
  }

  split(): GameState {
    if (this.phase !== 'playing') {
      this.message = 'Cannot split now.';
      return this.getState();
    }

    if (!this.canSplit()) {
      this.message = 'Cannot split this hand.';
      return this.getState();
    }

    const hand = this.playerHands[this.activeHandIndex];
    const bet = hand.bet;
    this.balance -= bet; // deduct additional bet for split hand

    // Split the two cards
    const card1 = hand.cards[0];
    const card2 = hand.cards[1];

    // Deal one new card to each hand
    const newCard1 = this.shoe.deal();
    const newCard2 = this.shoe.deal();

    const hand1 = makePlayerHand([card1, newCard1], bet);
    const hand2 = makePlayerHand([card2, newCard2], bet);

    // If splitting aces, only one card each and stand
    if (card1.rank === 'A') {
      hand1.stood = true;
      hand2.stood = true;
      this.playerHands.splice(this.activeHandIndex, 1, hand1, hand2);
      this.message = 'Split Aces. One card each.';
      this.advanceHand();
    } else {
      this.playerHands.splice(this.activeHandIndex, 1, hand1, hand2);
      this.message = `Split! Playing hand ${this.activeHandIndex + 1}.`;
      // Check if first hand is 21
      if (hand1.value === 21) {
        hand1.stood = true;
        this.advanceHand();
      }
    }

    return this.getState();
  }

  private advanceHand(): void {
    // Move to next unfinished hand
    for (let i = this.activeHandIndex + 1; i < this.playerHands.length; i++) {
      if (!this.playerHands[i].stood && !this.playerHands[i].busted) {
        this.activeHandIndex = i;
        this.message = `Playing hand ${i + 1}. Hit or Stand?`;
        return;
      }
    }

    // All player hands complete
    const allBusted = this.playerHands.every(h => h.busted);
    if (allBusted) {
      // Dealer skips play — resolve immediately
      this.resolveGame();
    } else {
      // Signal dealer turn; caller must drive dealer play (sync or async)
      this.phase = 'dealer_turn';
      this.message = "Dealer's turn…";
    }
  }

  /**
   * Plays dealer cards synchronously (fallback when no WebSocket is connected).
   */
  playDealerSync(): void {
    if (this.phase !== 'dealer_turn') return;
    while (this.shouldDealerHit()) {
      const card = this.shoe.deal();
      this.dealerHand.cards.push(card);
      const ev = evaluateHand(this.dealerHand.cards);
      this.dealerHand.value = ev.value;
      this.dealerHand.soft  = ev.soft;
      this.dealerHand.busted = ev.value > 21;
    }
    this.resolveGame();
  }

  /**
   * Plays dealer cards one at a time with delays, emitting state after each card.
   * Used by the WebSocket path for step-by-step animation on the client.
   */
  async runDealerPlay(emit: (s: GameState) => void): Promise<void> {
    if (this.phase !== 'dealer_turn') return;

    // First emission: hole card now visible (phase is dealer_turn, not playing)
    await sleep(350);
    emit(this.getState());

    while (this.shouldDealerHit()) {
      await sleep(780);
      const card = this.shoe.deal();
      this.dealerHand.cards.push(card);
      const ev = evaluateHand(this.dealerHand.cards);
      this.dealerHand.value = ev.value;
      this.dealerHand.soft  = ev.soft;
      this.dealerHand.busted = ev.value > 21;
      emit(this.getState());
    }

    await sleep(550);
    this.resolveGame();
    emit(this.getState());
  }

  private shouldDealerHit(): boolean {
    const { value, soft } = evaluateHand(this.dealerHand.cards);
    if (value < 17) return true;
    if (value === 17 && soft) return true; // hit soft 17
    return false;
  }

  private resolveGame(): void {
    this.phase = 'resolved';
    const dealerValue = this.dealerHand.value;
    const dealerBusted = this.dealerHand.busted;
    let totalWinnings = 0;

    for (const hand of this.playerHands) {
      if (hand.result !== 'pending') continue; // already resolved (busted)

      if (dealerBusted) {
        hand.result = 'win';
        const payout = hand.bet * 2;
        this.balance += payout;
        totalWinnings += hand.bet;
      } else if (hand.value > dealerValue) {
        hand.result = 'win';
        const payout = hand.bet * 2;
        this.balance += payout;
        totalWinnings += hand.bet;
      } else if (hand.value === dealerValue) {
        hand.result = 'push';
        this.balance += hand.bet;
      } else {
        hand.result = 'lose';
        totalWinnings -= hand.bet;
      }
    }

    if (totalWinnings > 0) {
      this.message = `You win $${totalWinnings}! Dealer had ${dealerValue}${dealerBusted ? ' (busted)' : ''}.`;
    } else if (totalWinnings < 0) {
      this.message = `You lose $${Math.abs(totalWinnings)}. Dealer had ${dealerValue}${dealerBusted ? ' (busted)' : ''}.`;
    } else {
      this.message = `Push! Dealer had ${dealerValue}.`;
    }
  }

  newRound(): GameState {
    this.phase = 'betting';
    this.playerHands = [];
    this.activeHandIndex = 0;
    this.dealerHand = { cards: [], value: 0, soft: false, busted: false, blackjack: false };
    this.currentBet = 0;

    if (this.balance <= 0) {
      this.balance = STARTING_BALANCE;
      this.message = 'Out of chips! Balance reset to $1000. Place your bet.';
    } else {
      this.message = 'Place your bet.';
    }

    return this.getState();
  }
}
