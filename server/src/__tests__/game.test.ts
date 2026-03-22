import { BlackjackGame } from '../game';
import { Shoe } from '../shoe';
import { Card } from '../../../shared/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const c = (rank: string, suit = 'hearts'): Card =>
  ({ rank: rank as Card['rank'], suit: suit as Card['suit'], faceUp: true });

/** Build a game whose shoe deals the given cards in order (index 0 = first deal). */
const game = (...cards: Card[]) => new BlackjackGame(new Shoe(cards));

/** Stand + sync dealer play, return final state. */
const standAndResolve = (g: BlackjackGame) => {
  g.stand();
  g.playDealerSync();
  return g.getState();
};

// ── placeBet ─────────────────────────────────────────────────────────────────

describe('placeBet', () => {
  test('deals 2 cards to player and 2 to dealer', () => {
    // deal order: p0 p1 d0 d1 …
    const g = game(c('K'), c('7'), c('Q'), c('6'), ...Array(50).fill(c('2')));
    const s = g.placeBet(25);
    expect(s.playerHands[0].cards).toHaveLength(2);
    expect(s.playerHands[0].value).toBe(17);
    expect(s.dealerHand.cards).toHaveLength(2);
    expect(s.phase).toBe('playing');
  });

  test('natural blackjack pays 3:2', () => {
    const g = game(c('A'), c('K'), c('7'), c('6'), ...Array(50).fill(c('2')));
    const s = g.placeBet(100);
    expect(s.phase).toBe('resolved');
    expect(s.playerHands[0].result).toBe('blackjack');
    // 1000 - 100 (bet) + 100 (stake back) + 150 (profit) = 1150
    expect(s.balance).toBe(1150);
  });

  test('dealer blackjack: player loses', () => {
    const g = game(c('K'), c('7'), c('A'), c('Q'), ...Array(50).fill(c('2')));
    const s = g.placeBet(50);
    expect(s.phase).toBe('resolved');
    expect(s.playerHands[0].result).toBe('lose');
    expect(s.balance).toBe(950);
  });

  test('both blackjack: push — bet returned', () => {
    // deal order: p0, p1, d0, d1 → A,K for player (21) and A,K for dealer (21)
    const g = game(c('A'), c('K'), c('A'), c('K'), ...Array(50).fill(c('2')));
    const s = g.placeBet(50);
    expect(s.phase).toBe('resolved');
    expect(s.playerHands[0].result).toBe('push');
    expect(s.balance).toBe(1000);
  });
});

// ── hit ───────────────────────────────────────────────────────────────────────

describe('hit', () => {
  test('player busts: result=lose, phase resolves (all busted)', () => {
    const g = game(c('K'), c('7'), c('Q'), c('6'), c('K'), ...Array(50).fill(c('2')));
    g.placeBet(25);
    const s = g.hit(); // 17 + K = 27
    expect(s.playerHands[0].busted).toBe(true);
    expect(s.playerHands[0].result).toBe('lose');
    expect(s.phase).toBe('resolved');
  });

  test('hitting to 21 auto-stands', () => {
    const g = game(c('K'), c('8'), c('Q'), c('6'), c('3'), ...Array(50).fill(c('2')));
    g.placeBet(25);
    const s = g.hit(); // 18 + 3 = 21
    expect(s.playerHands[0].value).toBe(21);
    expect(s.playerHands[0].stood).toBe(true);
  });
});

// ── dealer soft-17 rule ───────────────────────────────────────────────────────

describe('dealer soft-17', () => {
  test('dealer hits on soft 17 (A+6)', () => {
    // Player 18 stands. Dealer A,6 = soft 17 → must hit.
    const g = game(
      c('K'), c('8'),   // player 18
      c('A'), c('6'),   // dealer soft 17
      c('4'),           // dealer hit → A,6,4 = 21
      ...Array(50).fill(c('2')),
    );
    g.placeBet(25);
    const s = standAndResolve(g);
    expect(s.dealerHand.cards).toHaveLength(3);
    expect(s.dealerHand.value).toBe(21);
    expect(s.playerHands[0].result).toBe('lose');
  });

  test('dealer stands on hard 17', () => {
    const g = game(
      c('K'), c('8'),   // player 18
      c('Q'), c('7'),   // dealer hard 17 → stands
      ...Array(50).fill(c('2')),
    );
    g.placeBet(25);
    const s = standAndResolve(g);
    expect(s.dealerHand.cards).toHaveLength(2);
    expect(s.dealerHand.value).toBe(17);
    expect(s.playerHands[0].result).toBe('win');
  });

  test('dealer hits on soft 17 with A+A+5', () => {
    // A,A = 12 (two aces), then 5 → 17 soft → hit
    const g = game(
      c('K'), c('8'),   // player 18
      c('A'), c('A'),   // dealer A,A = 12
      c('5'),           // dealer A,A,5 = 17 soft → hit
      c('3'),           // dealer A,A,5,3 = 20 → stands
      ...Array(50).fill(c('2')),
    );
    g.placeBet(25);
    const s = standAndResolve(g);
    expect(s.dealerHand.value).toBe(20);
    expect(s.phase).toBe('resolved');
  });
});

// ── double down ───────────────────────────────────────────────────────────────

describe('double down', () => {
  test('doubles bet, deals exactly one card, auto-stands', () => {
    const g = game(
      c('5'), c('6'),   // player 11
      c('K'), c('6'),   // dealer 16
      c('K'),           // double card → 21
      ...Array(50).fill(c('2')),
    );
    g.placeBet(50);
    const s = g.double();
    expect(s.playerHands[0].bet).toBe(100);
    expect(s.playerHands[0].cards).toHaveLength(3);
    expect(s.playerHands[0].stood).toBe(true);
    expect(s.balance).toBe(900); // 1000 - 50 - 50
  });

  test('cannot double after hitting (3+ cards)', () => {
    const g = game(
      c('3'), c('4'),   // player 7
      c('K'), c('6'),
      c('4'),           // hit → 11
      ...Array(50).fill(c('2')),
    );
    g.placeBet(50);
    g.hit();
    const before = g.getState().playerHands[0].cards.length;
    g.double(); // should be rejected
    expect(g.getState().playerHands[0].cards.length).toBe(before);
  });
});

// ── split ─────────────────────────────────────────────────────────────────────

describe('split', () => {
  test('creates two independent hands', () => {
    const g = game(
      c('8'), c('8'),   // player pair
      c('K'), c('6'),   // dealer
      c('3'), c('5'),   // one card per split hand
      ...Array(50).fill(c('2')),
    );
    g.placeBet(50);
    const s = g.split();
    expect(s.playerHands).toHaveLength(2);
    expect(s.playerHands[0].cards).toHaveLength(2);
    expect(s.playerHands[1].cards).toHaveLength(2);
    expect(s.balance).toBe(900); // 1000 - 50 (orig) - 50 (split)
  });

  test('split aces: each hand gets exactly one card and stands', () => {
    const g = game(
      c('A'), c('A'),   // aces
      c('K'), c('6'),   // dealer
      c('K'), c('Q'),   // one card per ace
      ...Array(50).fill(c('2')),
    );
    g.placeBet(50);
    const s = g.split();
    expect(s.playerHands[0].stood).toBe(true);
    expect(s.playerHands[1].stood).toBe(true);
    expect(s.playerHands[0].cards).toHaveLength(2);
    expect(s.playerHands[1].cards).toHaveLength(2);
  });
});

// ── resolution ────────────────────────────────────────────────────────────────

describe('win / loss / push', () => {
  test('player wins: balance increases', () => {
    const g = game(
      c('K'), c('Q'),   // player 20
      c('Q'), c('7'),   // dealer 17 → stands
      ...Array(50).fill(c('2')),
    );
    g.placeBet(100);
    const s = standAndResolve(g);
    expect(s.playerHands[0].result).toBe('win');
    expect(s.balance).toBe(1100); // 1000 - 100 (bet) + 200 (win payout) = 1100
  });

  test('dealer busts: player wins', () => {
    const g = game(
      c('K'), c('8'),   // player 18
      c('K'), c('6'),   // dealer 16
      c('K'),           // dealer hits → 26 bust
      ...Array(50).fill(c('2')),
    );
    g.placeBet(50);
    const s = standAndResolve(g);
    expect(s.dealerHand.busted).toBe(true);
    expect(s.playerHands[0].result).toBe('win');
  });

  test('push: bet returned', () => {
    const g = game(
      c('K'), c('8'),   // player 18
      c('K'), c('8'),   // dealer 18
      ...Array(50).fill(c('2')),
    );
    g.placeBet(100);
    const s = standAndResolve(g);
    expect(s.playerHands[0].result).toBe('push');
    expect(s.balance).toBe(1000);
  });

  test('balance resets to 1000 when depleted', () => {
    // Lose enough to drain
    const g = game(
      c('K'), c('8'),   // player 18
      c('K'), c('Q'),   // dealer 20 → player loses
      ...Array(50).fill(c('2')),
    );
    g.placeBet(1000); // bet everything
    standAndResolve(g);
    const s = g.newRound();
    expect(s.balance).toBe(1000);
    expect(s.message).toContain('reset');
  });
});

// ── shoe mechanics ────────────────────────────────────────────────────────────

describe('shoe', () => {
  test('starts with 312 cards', () => {
    const shoe = new Shoe();
    expect(shoe.remaining).toBe(312);
  });

  test('needsReshuffle triggers at 75% dealt', () => {
    const shoe = new Shoe();
    expect(shoe.needsReshuffle()).toBe(false);
    for (let i = 0; i < 234; i++) shoe.deal(); // 75% of 312
    expect(shoe.needsReshuffle()).toBe(true);
  });

  test('predefined shoe deals cards in given order', () => {
    const cards = [c('A'), c('K'), c('7'), c('3')];
    const shoe  = new Shoe(cards);
    expect(shoe.deal().rank).toBe('A');
    expect(shoe.deal().rank).toBe('K');
    expect(shoe.deal().rank).toBe('7');
    expect(shoe.deal().rank).toBe('3');
  });
});
