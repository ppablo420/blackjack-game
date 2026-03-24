import Phaser from 'phaser';
import { api } from '../api';
import { GameState, Card, PlayerHand } from '../../../shared/types';
import { createCardSprite, CARD_WIDTH, CARD_HEIGHT } from '../cardRenderer';
import { sounds } from '../sounds';

// ── Layout ──────────────────────────────────────────────────────────────────
const W = 1280, H = 720;
const DEALER_Y  = 200;
const PLAYER_Y  = 480;
const BTNS_Y    = 638;
const SHOE_X    = W - 80, SHOE_Y = 82;
const GOLD_NUM  = 0xffd700;

// ── Colours ──────────────────────────────────────────────────────────────────
const GOLD  = '#ffd700';
const WHITE = '#ffffff';

// ─────────────────────────────────────────────────────────────────────────────
export class BlackjackScene extends Phaser.Scene {

  // state
  private state: GameState | null = null;

  // card sprite registry – key: "d0","d1" dealer │ "p0_0","p1_2" player
  private cardMap = new Map<string, Phaser.GameObjects.Container>();

  // persistent UI
  private balanceText!: Phaser.GameObjects.Text;
  private betText!:     Phaser.GameObjects.Text;
  private msgText!:     Phaser.GameObjects.Text;
  private dealerValText!: Phaser.GameObjects.Text;
  private shoeText!:    Phaser.GameObjects.Text;

  // dynamic UI pools
  private actionBtns:   Phaser.GameObjects.Container[] = [];
  private betChips:     Phaser.GameObjects.Container[] = [];
  private valueLabels:  Phaser.GameObjects.Text[]      = [];
  private resultLabels: Phaser.GameObjects.Text[]      = [];

  private busy = false;
  private ws: WebSocket | null = null;

  constructor() { super({ key: 'BlackjackScene' }); }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  create(): void {
    this.drawTable();
    this.drawShoe();
    this.drawDealer();
    this.buildPersistentUI();
    this.connectWS();
    this.fetchState();
  }

  // ── WebSocket (dealer step-by-step reveal) ──────────────────────────────────
  private connectWS(): void {
    const sid = localStorage.getItem('blackjack_session') ?? '';
    this.ws = new WebSocket(`ws://localhost:3001?sessionId=${encodeURIComponent(sid)}`);

    this.ws.onmessage = async (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        if (msg.type === 'state' && !this.busy) {
          this.busy = true;
          await this.applyState(msg.state, true);
          this.busy = false;
        }
      } catch { /* ignore malformed messages */ }
    };

    this.ws.onclose = () => {
      this.ws = null;
      // Reconnect after 3 s — keeps working after server restart
      this.time.delayedCall(3000, () => this.connectWS());
    };
  }

  // ── Table ──────────────────────────────────────────────────────────────────
  private drawTable(): void {
    const MAPLE   = 0xb06822;   // maple wood border
    const FELT_BG = 0x0f0000;   // near-black background
    const FELT_OUT = 0x3a0000;  // dark crimson outer felt
    const FELT_IN  = 0x4d0808;  // dark crimson inner felt (slightly lighter)

    const bg = this.add.graphics();

    // Maple-wood outer ring
    bg.fillStyle(FELT_BG, 1);
    bg.fillRect(0, 0, W, H);

    // Dark crimson outer felt
    bg.fillStyle(FELT_OUT, 1);
    bg.fillRoundedRect(12, 12, W - 24, H - 24, 32);

    // Dark crimson inner felt (slightly lighter)
    bg.fillStyle(FELT_IN, 1);
    bg.fillRoundedRect(26, 26, W - 52, H - 52, 26);

    // Maple thick outer border
    const brd = this.add.graphics();
    brd.lineStyle(7, MAPLE, 1);
    brd.strokeRoundedRect(12, 12, W - 24, H - 24, 32);

    // Maple thin inner border
    brd.lineStyle(2, MAPLE, 0.55);
    brd.strokeRoundedRect(36, 36, W - 72, H - 72, 22);

    // Gold highlight line just inside the thick border
    brd.lineStyle(1.5, GOLD_NUM, 0.28);
    brd.strokeRoundedRect(22, 22, W - 44, H - 44, 28);

    // Dealer arc (maple, subtle)
    const arc = this.add.graphics();
    arc.lineStyle(1.5, MAPLE, 0.3);
    arc.beginPath();
    arc.arc(W / 2, 16, 260, Math.PI * 0.13, Math.PI * 0.87, false);
    arc.strokePath();

    // Divider line (maple, subtle)
    const div = this.add.graphics();
    div.lineStyle(1, MAPLE, 0.25);
    div.beginPath();
    div.moveTo(100, 330); div.lineTo(W - 100, 330);
    div.strokePath();

    // Casino name
    this.add.text(W / 2, 40, 'YONI CASINO', {
      fontSize: '14px', fontFamily: 'Georgia, serif',
      color: GOLD, fontStyle: 'bold', letterSpacing: 8,
    }).setOrigin(0.5).setAlpha(0.6);

    // Area labels
    this.add.text(W / 2, 58, 'DEALER', {
      fontSize: '10px', fontFamily: 'Georgia, serif',
      color: '#c8a060', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.6);
    this.add.text(W / 2, 406, 'PLAYER', {
      fontSize: '10px', fontFamily: 'Georgia, serif',
      color: '#c8a060', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.6);

    // Decorative suit symbols — subtle crimson tones on red felt
    const suitDeco: { x: number; y: number; sym: string }[] = [
      { x: 110,         y: 178,     sym: '♠' },
      { x: W - 110,     y: 178,     sym: '♣' },
      { x: 110,         y: H - 178, sym: '♥' },
      { x: W - 110,     y: H - 178, sym: '♦' },
      { x: W / 2 - 200, y: H / 2,   sym: '♦' },
      { x: W / 2 - 65,  y: H / 2,   sym: '♠' },
      { x: W / 2 + 65,  y: H / 2,   sym: '♥' },
      { x: W / 2 + 200, y: H / 2,   sym: '♣' },
    ];
    suitDeco.forEach(({ x, y, sym }) => {
      const isRed = sym === '♥' || sym === '♦';
      this.add.text(x, y, sym, {
        fontSize: '56px', fontFamily: 'serif',
        color: isRed ? '#8b0000' : '#3a0000',
      }).setOrigin(0.5).setAlpha(0.38);
    });
  }

  private drawShoe(): void {
    // Shoe rendered as a stack of card-sized cards with YONI CASINO branding
    const CW = CARD_WIDTH, CH = CARD_HEIGHT;
    const g  = this.add.graphics();

    // Stack of 7 cards offset slightly
    for (let i = 6; i >= 0; i--) {
      const ox = i * 2.5, oy = i * 1.2;
      g.fillStyle(0x5a0808, 1);
      g.fillRoundedRect(SHOE_X - CW / 2 + ox, SHOE_Y - CH / 2 + oy, CW, CH, 8);
      g.lineStyle(i === 0 ? 2 : 1, GOLD_NUM, i === 0 ? 0.9 : 0.3);
      g.strokeRoundedRect(SHOE_X - CW / 2 + ox, SHOE_Y - CH / 2 + oy, CW, CH, 8);
    }
    // Inner gold border on top card
    g.lineStyle(1, GOLD_NUM, 0.4);
    g.strokeRoundedRect(SHOE_X - CW / 2 + 5, SHOE_Y - CH / 2 + 5, CW - 10, CH - 10, 5);

    // Branding on top card
    this.add.text(SHOE_X, SHOE_Y - 14, '♦', {
      fontSize: '22px', fontFamily: 'serif', color: '#c8a000',
    }).setOrigin(0.5);
    this.add.text(SHOE_X, SHOE_Y + 8, 'YONI', {
      fontSize: '12px', fontFamily: 'Georgia, serif',
      color: GOLD, fontStyle: 'bold', letterSpacing: 2,
    }).setOrigin(0.5);
    this.add.text(SHOE_X, SHOE_Y + 22, 'CASINO', {
      fontSize: '8px', fontFamily: 'Georgia, serif',
      color: '#c8a000', fontStyle: 'bold', letterSpacing: 3,
    }).setOrigin(0.5);

    // Cards remaining counter below shoe
    this.shoeText = this.add.text(SHOE_X, SHOE_Y + CH / 2 + 14, '312 cards', {
      fontSize: '9px', fontFamily: 'Georgia, serif', color: '#7a8899',
    }).setOrigin(0.5);
  }

  // ── Dealer character ────────────────────────────────────────────────────────
  private drawDealer(): void {
    const container = this.add.container(W / 2, 148);
    const cx = 0, cy = 0;
    const g  = this.add.graphics();

    const JACKET       = 0x14141e;
    const JACKET_DARK  = 0x0a0a12;
    const SHIRT        = 0xf4efe6;
    const SKIN         = 0xc8845a;
    const SKIN_DARK    = 0x9e6040;
    const SKIN_LIGHT   = 0xdda070;

    // ── ARMS ──────────────────────────────────────────────────────────────────
    g.fillStyle(JACKET, 1);
    g.fillRoundedRect(cx - 46, cy + 14, 17, 70, 6);
    g.fillRoundedRect(cx + 29, cy + 14, 17, 70, 6);
    // Arm inner shadow
    g.fillStyle(JACKET_DARK, 0.7);
    g.fillRoundedRect(cx - 46, cy + 14, 5, 70, 6);
    g.fillRoundedRect(cx + 41, cy + 14, 5, 70, 6);
    // Cuffs
    g.fillStyle(SHIRT, 1);
    g.fillRoundedRect(cx - 46, cy + 74, 17, 11, 3);
    g.fillRoundedRect(cx + 29, cy + 74, 17, 11, 3);
    // Cuff gold links
    g.fillStyle(GOLD_NUM, 0.9);
    g.fillCircle(cx - 38, cy + 80, 2);
    g.fillCircle(cx + 38, cy + 80, 2);

    // ── TORSO ─────────────────────────────────────────────────────────────────
    g.fillStyle(JACKET, 1);
    g.fillRect(cx - 32, cy + 14, 64, 72);
    // Jacket side shadows
    g.fillStyle(JACKET_DARK, 0.8);
    g.fillRect(cx - 32, cy + 14, 8, 72);
    g.fillRect(cx + 24, cy + 14, 8, 72);
    // Shoulders
    g.fillStyle(JACKET, 1);
    g.fillEllipse(cx - 36, cy + 17, 26, 13);
    g.fillEllipse(cx + 36, cy + 17, 26, 13);

    // ── SHIRT & LAPELS ────────────────────────────────────────────────────────
    // Shirt front (V shape)
    g.fillStyle(SHIRT, 1);
    g.fillTriangle(cx, cy + 14, cx - 15, cy + 14, cx, cy + 58);
    g.fillTriangle(cx, cy + 14, cx + 15, cy + 14, cx, cy + 58);
    // Left lapel
    g.fillStyle(JACKET, 1);
    g.fillTriangle(cx - 32, cy + 14, cx - 14, cy + 16, cx - 32, cy + 46);
    // Right lapel
    g.fillTriangle(cx + 32, cy + 14, cx + 14, cy + 16, cx + 32, cy + 46);
    // Lapel edge highlight
    g.lineStyle(0.8, 0x2a2a3a, 0.9);
    g.beginPath();
    g.moveTo(cx - 32, cy + 14); g.lineTo(cx - 14, cy + 16); g.lineTo(cx, cy + 14);
    g.strokePath();
    g.beginPath();
    g.moveTo(cx + 32, cy + 14); g.lineTo(cx + 14, cy + 16); g.lineTo(cx, cy + 14);
    g.strokePath();

    // Pocket square
    g.fillStyle(SHIRT, 0.95);
    g.fillRect(cx - 28, cy + 26, 11, 8);
    g.fillStyle(GOLD_NUM, 0.7);
    g.fillTriangle(cx - 28, cy + 26, cx - 17, cy + 26, cx - 23, cy + 21);

    // ── TIE ───────────────────────────────────────────────────────────────────
    // Deep red tie
    g.fillStyle(0x8b0000, 1);
    g.fillTriangle(cx - 6, cy + 14, cx + 6, cy + 14, cx + 4, cy + 56);
    g.fillTriangle(cx - 6, cy + 14, cx + 6, cy + 14, cx - 4, cy + 56);
    // Tie knot
    g.fillStyle(0x6a0000, 1);
    g.fillEllipse(cx, cy + 16, 13, 10);
    // Tie highlight
    g.lineStyle(0.8, 0xcc1a1a, 0.45);
    g.beginPath(); g.moveTo(cx, cy + 20); g.lineTo(cx + 1, cy + 52); g.strokePath();
    // Shirt buttons
    [32, 44].forEach(dy => {
      g.fillStyle(SHIRT, 0.6);
      g.fillCircle(cx + 9, cy + dy, 2);
    });

    // Collar points
    g.fillStyle(SHIRT, 1);
    g.fillTriangle(cx - 15, cy + 10, cx - 6, cy + 20, cx - 1, cy + 10);
    g.fillTriangle(cx + 15, cy + 10, cx + 6, cy + 20, cx + 1, cy + 10);

    // ── NECK ──────────────────────────────────────────────────────────────────
    g.fillStyle(SKIN, 1);
    g.fillRect(cx - 8, cy + 6, 16, 14);
    g.fillStyle(SKIN_DARK, 0.4);
    g.fillRect(cx - 8, cy + 6, 4, 14);
    g.fillRect(cx + 4,  cy + 6, 4, 14);

    // ── HEAD ──────────────────────────────────────────────────────────────────
    // Shadow layer (gives depth)
    g.fillStyle(SKIN_DARK, 0.35);
    g.fillEllipse(cx + 2, cy - 14, 52, 58);
    // Main head
    g.fillStyle(SKIN, 1);
    g.fillEllipse(cx, cy - 16, 52, 58);
    // Cheek shadow
    g.fillStyle(SKIN_DARK, 0.18);
    g.fillEllipse(cx - 16, cy - 4, 20, 24);
    g.fillEllipse(cx + 16, cy - 4, 20, 24);
    // Forehead highlight
    g.fillStyle(SKIN_LIGHT, 0.22);
    g.fillEllipse(cx, cy - 26, 32, 18);

    // Ears
    g.fillStyle(SKIN, 1);
    g.fillEllipse(cx - 26, cy - 12, 11, 19);
    g.fillEllipse(cx + 26, cy - 12, 11, 19);
    // Ear inner
    g.fillStyle(SKIN_DARK, 0.35);
    g.fillEllipse(cx - 26, cy - 12, 6, 12);
    g.fillEllipse(cx + 26, cy - 12, 6, 12);

    // ── HAIR ──────────────────────────────────────────────────────────────────
    g.fillStyle(0x100c06, 1);
    g.fillEllipse(cx, cy - 35, 54, 28);
    g.fillRect(cx - 27, cy - 40, 10, 30);
    g.fillRect(cx + 17, cy - 40, 10, 30);
    g.fillEllipse(cx, cy - 44, 50, 18);
    // Hair highlight (sheen)
    g.fillStyle(0x2e2010, 0.55);
    g.fillEllipse(cx + 7, cy - 40, 18, 11);

    // ── EYES ──────────────────────────────────────────────────────────────────
    // Subtle eye socket shadow
    g.fillStyle(SKIN_DARK, 0.18);
    g.fillEllipse(cx - 11, cy - 12, 22, 13);
    g.fillEllipse(cx + 11, cy - 12, 22, 13);
    // Eye whites
    g.fillStyle(0xf8f5ee, 1);
    g.fillEllipse(cx - 11, cy - 12, 17, 10);
    g.fillEllipse(cx + 11, cy - 12, 17, 10);
    // Iris
    g.fillStyle(0x3e2610, 1);
    g.fillCircle(cx - 11, cy - 12, 4.2);
    g.fillCircle(cx + 11, cy - 12, 4.2);
    // Pupil
    g.fillStyle(0x060402, 1);
    g.fillCircle(cx - 11, cy - 12, 2.4);
    g.fillCircle(cx + 11, cy - 12, 2.4);
    // Specular highlight
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx - 9.2, cy - 13.5, 1.3);
    g.fillCircle(cx + 12.8, cy - 13.5, 1.3);
    // Upper eyelid line
    g.lineStyle(1.3, 0x140a04, 0.9);
    g.beginPath(); g.arc(cx - 11, cy - 12, 8.5, Math.PI * 0.82, Math.PI * 0.18, false); g.strokePath();
    g.beginPath(); g.arc(cx + 11, cy - 12, 8.5, Math.PI * 0.82, Math.PI * 0.18, false); g.strokePath();
    // Eyelid fold (almond)
    g.fillStyle(SKIN, 1);
    g.fillTriangle(cx - 20, cy - 12, cx - 11, cy - 17, cx - 2, cy - 12);
    g.fillTriangle(cx + 2,  cy - 12, cx + 11, cy - 17, cx + 20, cy - 12);

    // ── EYEBROWS ──────────────────────────────────────────────────────────────
    g.fillStyle(0x160e06, 1);
    for (let i = 0; i < 15; i++) {
      const t  = i / 14;
      const bx = cx - 19 + i;
      const by = cy - 22 - Math.sin(t * Math.PI) * 2.5;
      g.fillRect(bx, by, 1.5, 2.8);
    }
    for (let i = 0; i < 15; i++) {
      const t  = i / 14;
      const bx = cx + 4 + i;
      const by = cy - 22 - Math.sin(t * Math.PI) * 2.5;
      g.fillRect(bx, by, 1.5, 2.8);
    }

    // ── NOSE ──────────────────────────────────────────────────────────────────
    // Bridge shadow lines
    g.lineStyle(0.9, SKIN_DARK, 0.3);
    g.beginPath(); g.moveTo(cx - 3, cy - 18); g.lineTo(cx - 5, cy - 2); g.strokePath();
    g.beginPath(); g.moveTo(cx + 3, cy - 18); g.lineTo(cx + 5, cy - 2); g.strokePath();
    // Tip
    g.fillStyle(SKIN_DARK, 0.28);
    g.fillEllipse(cx, cy - 1, 12, 8);
    // Nostrils
    g.fillStyle(SKIN_DARK, 0.48);
    g.fillEllipse(cx - 5, cy + 1, 5, 4);
    g.fillEllipse(cx + 5, cy + 1, 5, 4);

    // ── MOUTH ─────────────────────────────────────────────────────────────────
    // Upper lip
    g.fillStyle(0x9a5030, 0.75);
    g.fillEllipse(cx, cy + 11, 19, 6);
    // Lower lip
    g.fillStyle(0xac6040, 0.65);
    g.fillEllipse(cx, cy + 15, 17, 7);
    // Mouth crease
    g.lineStyle(1.3, 0x7a3818, 0.85);
    g.beginPath(); g.arc(cx, cy + 16, 9.5, Math.PI * 0.08, Math.PI * 0.92, false); g.strokePath();
    // Subtle smile corners
    g.lineStyle(1, 0x7a3818, 0.5);
    g.beginPath(); g.arc(cx - 9, cy + 14, 3, Math.PI * 0.5, Math.PI, false); g.strokePath();
    g.beginPath(); g.arc(cx + 9, cy + 14, 3, 0, Math.PI * 0.5, false); g.strokePath();

    // ── VISOR ─────────────────────────────────────────────────────────────────
    g.fillStyle(0x0a2a14, 0.97);
    g.fillRoundedRect(cx - 31, cy - 54, 62, 16, 5);
    // Brim (translucent shade)
    g.fillStyle(0x0d3318, 0.45);
    g.fillRoundedRect(cx - 31, cy - 41, 62, 5, 2);
    // Gold trim
    g.lineStyle(1.5, GOLD_NUM, 0.75);
    g.strokeRoundedRect(cx - 31, cy - 54, 62, 16, 5);
    // Visor inner highlight
    g.fillStyle(0x2a7040, 0.18);
    g.fillRoundedRect(cx - 29, cy - 53, 58, 6, 3);

    // Label
    const label = this.add.text(cx, cy + 100, '· D E A L E R ·', {
      fontSize: '9px', fontFamily: 'Georgia, serif',
      color: '#8a7050', letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0.78);

    container.add([g, label]);
    container.setScale(1.4);
  }

  // ── Persistent UI ──────────────────────────────────────────────────────────
  private buildPersistentUI(): void {
    const bar = this.add.graphics();
    bar.fillStyle(0x03070e, 0.85);
    bar.fillRect(0, H - 52, W, 52);
    bar.lineStyle(1, GOLD_NUM, 0.3);
    bar.beginPath(); bar.moveTo(0, H - 52); bar.lineTo(W, H - 52); bar.strokePath();

    this.balanceText = this.add.text(60, H - 28, 'Balance: $1000', {
      fontSize: '18px', fontFamily: 'Georgia, serif',
      color: GOLD, fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(30);

    this.betText = this.add.text(W / 2, H - 28, 'Bet: $0', {
      fontSize: '18px', fontFamily: 'Georgia, serif', color: WHITE,
    }).setOrigin(0.5).setDepth(30);

    this.msgText = this.add.text(W / 2, 320, '', {
      fontSize: '22px', fontFamily: 'Georgia, serif',
      color: WHITE, fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5).setDepth(30);

    this.dealerValText = this.add.text(W / 2, DEALER_Y + CARD_HEIGHT / 2 + 36, '', {
      fontSize: '14px', fontFamily: 'Georgia, serif', color: '#ddd',
      backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 10, y: 4 },
    }).setOrigin(0.5).setDepth(20);
  }

  // ── API helpers ────────────────────────────────────────────────────────────
  private async fetchState(): Promise<void> {
    try {
      const r = await api.getState();
      if (r.success) await this.applyState(r.state, false);
    } catch {
      this.msgText.setText('Cannot connect to server.\nMake sure the server is running on port 3001.');
    }
  }

  private async call(fn: () => Promise<any>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const r = await fn();
      if (r?.success) await this.applyState(r.state, true);
    } catch {
      this.msgText.setText('Server error — please refresh.');
    }
    this.busy = false;
  }

  // ── Core state machine ─────────────────────────────────────────────────────
  private async applyState(next: GameState, animate: boolean): Promise<void> {
    const prev = this.state;
    this.state = next;

    this.balanceText.setText(`Balance: $${next.balance}`);
    this.betText.setText(`Bet: $${next.currentBet}`);
    this.shoeText.setText(`${next.cardsRemaining}`);

    const phaseChanged = !prev || prev.phase !== next.phase;

    // ── BETTING phase ────────────────────────────────────────────────────────
    if (next.phase === 'betting') {
      if (phaseChanged) {
        await this.clearTableAnimated(animate);
        this.clearDynamicUI();
        this.setMessage(next.message);
        this.showBetChips(animate);
      }
      return;
    }

    // ── PLAYING / DEALER_TURN / RESOLVED ─────────────────────────────────────
    if (phaseChanged && next.phase === 'playing') {
      this.clearBetChips();
      this.setMessage('');
    }

    await this.syncCards(next, prev, animate);
    this.syncValueLabels(next);

    if (next.phase === 'playing') {
      this.setMessage('');
      this.showActionButtons(next);
    } else if (next.phase === 'dealer_turn') {
      this.clearActionButtons();
      this.setMessage("Dealer's turn…");
    } else if (next.phase === 'resolved') {
      this.clearActionButtons();
      this.setMessage(next.message);
      this.showResults(next, animate);
      this.showNewRoundButton(animate);
      this.playResultSound(next);
      if (animate) this.animateChipScrape(next);
    }
  }

  // ── Card sync (diff engine) ────────────────────────────────────────────────
  private cardIdentity(card: Card): string {
    return card.faceUp ? `${card.rank}_${card.suit}` : 'back';
  }

  private async syncCards(next: GameState, prev: GameState | null, animate: boolean): Promise<void> {
    const tasks: Promise<void>[] = [];
    let stagger = 0;

    // Dealer cards
    const dTotal = next.dealerHand.cards.length;
    next.dealerHand.cards.forEach((card, i) => {
      const key      = `d${i}`;
      const pos      = this.dealerCardPos(i, dTotal);
      const existing = this.cardMap.get(key);
      const prevCard = prev?.dealerHand.cards[i];

      // Card identity changed (shouldn't happen for dealer, but be safe)
      if (existing && prevCard && this.cardIdentity(prevCard) !== this.cardIdentity(card)
          && prevCard.faceUp && card.faceUp) {
        existing.destroy();
        this.cardMap.delete(key);
        tasks.push(this.dealCard(key, card, pos.x, pos.y, animate ? stagger : 0));
        stagger += 145;
        return;
      }

      if (!existing) {
        tasks.push(this.dealCard(key, card, pos.x, pos.y, animate ? stagger : 0));
        stagger += 145;
      } else {
        if (Math.abs(existing.x - pos.x) > 1)
          this.tweens.add({ targets: existing, x: pos.x, duration: 220, ease: 'Cubic.easeOut' });
        if (prevCard && !prevCard.faceUp && card.faceUp) {
          tasks.push(this.flipCard(key, card, animate ? stagger : 0));
          stagger += 145;
        }
      }
    });

    // Player cards
    const totalHands = next.playerHands.length;
    next.playerHands.forEach((hand, hIdx) => {
      const totalCards = hand.cards.length;
      hand.cards.forEach((card, cIdx) => {
        const key      = `p${hIdx}_${cIdx}`;
        const pos      = this.playerCardPos(hIdx, cIdx, totalHands, totalCards);
        const existing = this.cardMap.get(key);
        const prevCard = prev?.playerHands[hIdx]?.cards[cIdx];

        // Card identity changed (e.g. after split — old p0_1 becomes a different card)
        if (existing && prevCard && this.cardIdentity(prevCard) !== this.cardIdentity(card)
            && prevCard.faceUp && card.faceUp) {
          existing.destroy();
          this.cardMap.delete(key);
          tasks.push(this.dealCard(key, card, pos.x, pos.y, animate ? stagger : 0));
          stagger += 145;
          return;
        }

        if (!existing) {
          tasks.push(this.dealCard(key, card, pos.x, pos.y, animate ? stagger : 0));
          stagger += 145;
        } else {
          if (Math.abs(existing.x - pos.x) > 1 || Math.abs(existing.y - pos.y) > 1)
            this.tweens.add({ targets: existing, x: pos.x, y: pos.y, duration: 220, ease: 'Cubic.easeOut' });
          if (prevCard && !prevCard.faceUp && card.faceUp) {
            tasks.push(this.flipCard(key, card, animate ? stagger : 0));
            stagger += 145;
          }
        }
      });
    });

    // Remove stale cards (e.g. after split changes hand count)
    const valid = new Set<string>();
    next.dealerHand.cards.forEach((_, i) => valid.add(`d${i}`));
    next.playerHands.forEach((hand, hIdx) => hand.cards.forEach((_, cIdx) => valid.add(`p${hIdx}_${cIdx}`)));

    this.cardMap.forEach((sprite, key) => {
      if (!valid.has(key)) {
        this.tweens.add({ targets: sprite, alpha: 0, duration: 180, onComplete: () => {
          sprite.destroy();
          this.cardMap.delete(key);
        }});
      }
    });

    if (tasks.length) await Promise.all(tasks);
  }

  // ── Position helpers ───────────────────────────────────────────────────────
  private dealerCardPos(i: number, total: number) {
    const spacing = Math.min(70, (W - 280) / Math.max(total, 1));
    return { x: W / 2 - ((total - 1) * spacing) / 2 + i * spacing, y: DEALER_Y };
  }

  private playerCardPos(hIdx: number, cIdx: number, totalHands: number, totalCards: number) {
    const handGap = totalHands > 1 ? 240 : 0;
    const cardGap = Math.min(66, (W - 280) / Math.max(totalCards, 1));
    const centerX = W / 2 + (hIdx - (totalHands - 1) / 2) * handGap;
    return { x: centerX - ((totalCards - 1) * cardGap) / 2 + cIdx * cardGap, y: PLAYER_Y };
  }

  // ── Card animations ────────────────────────────────────────────────────────
  private dealCard(key: string, card: Card, toX: number, toY: number, delay: number): Promise<void> {
    return new Promise(resolve => {
      const sprite = createCardSprite(this, card, SHOE_X, SHOE_Y);
      sprite.setDepth(5 + this.cardMap.size);
      sprite.setAngle(-18);
      this.cardMap.set(key, sprite);

      this.time.delayedCall(delay, () => {
        sounds.cardDeal();
        const startX = SHOE_X, startY = SHOE_Y;
        const arcHeight = 90;

        // Arc trajectory via counter tween
        this.tweens.addCounter({
          from: 0, to: 1,
          duration: 340,
          ease: 'Cubic.easeOut',
          onUpdate: (tween) => {
            const t = tween.getValue();
            sprite.x = Phaser.Math.Linear(startX, toX, t);
            sprite.y = Phaser.Math.Linear(startY, toY, t) - Math.sin(t * Math.PI) * arcHeight;
            sprite.angle = Phaser.Math.Linear(-18, 0, t);
          },
          onComplete: () => resolve(),
        });
      });
    });
  }

  private flipCard(key: string, newCard: Card, delay: number): Promise<void> {
    const sprite = this.cardMap.get(key);
    if (!sprite) return Promise.resolve();
    const { x, y } = sprite;

    return new Promise(resolve => {
      this.time.delayedCall(delay, () => {
        sounds.flip();
        this.tweens.add({
          targets: sprite, scaleX: 0,
          duration: 130, ease: 'Cubic.easeIn',
          onComplete: () => {
            sprite.destroy();
            const ns = createCardSprite(this, newCard, x, y);
            ns.setScale(0, 1);
            ns.setDepth(sprite.depth + 1);
            this.cardMap.set(key, ns);
            this.tweens.add({
              targets: ns, scaleX: 1,
              duration: 130, ease: 'Cubic.easeOut',
              onComplete: () => resolve(),
            });
          },
        });
      });
    });
  }

  // ── Clear table ────────────────────────────────────────────────────────────
  private clearTableAnimated(animate: boolean): Promise<void> {
    const sprites = Array.from(this.cardMap.values());
    this.valueLabels.forEach(t => t.destroy());  this.valueLabels = [];
    this.resultLabels.forEach(t => t.destroy()); this.resultLabels = [];
    this.dealerValText.setText('');
    this.msgText.setText('');

    if (!sprites.length) { this.cardMap.clear(); return Promise.resolve(); }
    if (!animate)        { sprites.forEach(s => s.destroy()); this.cardMap.clear(); return Promise.resolve(); }

    return new Promise(resolve => {
      let done = 0;
      sprites.forEach((s, i) => {
        const startX = s.x, startY = s.y;
        this.tweens.addCounter({
          from: 0, to: 1,
          duration: 300, delay: i * 30, ease: 'Cubic.easeIn',
          onUpdate: (tween) => {
            const t = tween.getValue();
            s.x = Phaser.Math.Linear(startX, SHOE_X, t);
            s.y = Phaser.Math.Linear(startY, SHOE_Y, t) - Math.sin(t * Math.PI) * 60;
            s.alpha = 1 - t * t;
          },
          onComplete: () => {
            s.destroy();
            if (++done === sprites.length) { this.cardMap.clear(); resolve(); }
          },
        });
      });
    });
  }

  // ── Value labels ───────────────────────────────────────────────────────────
  private syncValueLabels(state: GameState): void {
    this.valueLabels.forEach(t => t.destroy()); this.valueLabels = [];

    // Dealer
    const dv   = state.dealerHand.value;
    const dStr = state.phase === 'playing'
      ? `${dv}`
      : state.dealerHand.soft ? `${dv} (soft)` : `${dv}`;
    this.dealerValText.setText(`Dealer: ${dStr}`);

    // Player hands
    const totalHands = state.playerHands.length;
    state.playerHands.forEach((hand, hIdx) => {
      const cx       = W / 2 + (hIdx - (totalHands - 1) / 2) * (totalHands > 1 ? 230 : 0);
      const isActive = hIdx === state.activeHandIndex && state.phase === 'playing';

      const soft   = hand.soft && hand.value <= 21;
      const valStr = hand.busted    ? `BUST (${hand.value})`
                   : hand.blackjack ? 'BLACKJACK!'
                   : soft           ? `${hand.value} / ${hand.value - 10}`
                   : `${hand.value}`;
      const color  = hand.busted    ? '#ef4444'
                   : hand.blackjack ? GOLD
                   : isActive       ? WHITE
                   : '#aaa';

      const vt = this.add.text(cx, PLAYER_Y + CARD_HEIGHT / 2 + 22, valStr, {
        fontSize: '15px', fontFamily: 'Georgia, serif',
        color, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(18);
      this.valueLabels.push(vt);

      if (totalHands > 1) {
        const hl = this.add.text(cx, PLAYER_Y - CARD_HEIGHT / 2 - 20, `Hand ${hIdx + 1}`, {
          fontSize: '11px', fontFamily: 'Georgia, serif',
          color: isActive ? GOLD : '#666',
          fontStyle: isActive ? 'bold' : 'normal',
        }).setOrigin(0.5).setDepth(18);
        this.valueLabels.push(hl);
      }

      const bl = this.add.text(cx, PLAYER_Y + CARD_HEIGHT / 2 + 40, `$${hand.bet}`, {
        fontSize: '13px', fontFamily: 'Georgia, serif', color: '#bbb',
      }).setOrigin(0.5).setDepth(18);
      this.valueLabels.push(bl);
    });
  }

  // ── Results ────────────────────────────────────────────────────────────────
  private showResults(state: GameState, animate: boolean): void {
    this.resultLabels.forEach(t => t.destroy()); this.resultLabels = [];

    const map: Record<string, { txt: string; col: string }> = {
      blackjack: { txt: 'BLACKJACK!', col: GOLD       },
      win:       { txt: '+ WIN',      col: '#22c55e'  },
      lose:      { txt: 'LOSE',       col: '#ef4444'  },
      push:      { txt: 'PUSH',       col: '#facc15'  },
    };

    const totalHands = state.playerHands.length;
    state.playerHands.forEach((hand, hIdx) => {
      const r = map[hand.result];
      if (!r) return;
      const cx = W / 2 + (hIdx - (totalHands - 1) / 2) * (totalHands > 1 ? 230 : 0);

      const rt = this.add.text(cx, 348, r.txt, {
        fontSize: '28px', fontFamily: 'Georgia, serif',
        color: r.col, fontStyle: 'bold',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(25);

      if (animate) {
        rt.setScale(0.4).setAlpha(0);
        this.tweens.add({
          targets: rt, scaleX: 1, scaleY: 1, alpha: 1,
          duration: 360, ease: 'Back.easeOut', delay: 200 + hIdx * 120,
        });
      }
      this.resultLabels.push(rt);
    });
  }

  // ── Message ────────────────────────────────────────────────────────────────
  private setMessage(text: string): void {
    this.msgText.setText(text);
    if (text) {
      this.msgText.setAlpha(0);
      this.tweens.add({ targets: this.msgText, alpha: 1, duration: 300 });
    }
  }

  // ── Bet chips ──────────────────────────────────────────────────────────────
  private showBetChips(animate: boolean): void {
    this.clearBetChips();
    const amounts = [5, 10, 25, 50, 100];
    const spacing = 82;
    const startX  = W / 2 - ((amounts.length - 1) * spacing) / 2;

    amounts.forEach((amount, i) => {
      const x = startX + i * spacing;
      const y = H / 2 + 30;
      const chip = this.makeChip(x, y, amount);
      if (animate) {
        chip.setY(y + 70).setAlpha(0);
        this.tweens.add({ targets: chip, y, alpha: 1, duration: 320, ease: 'Back.easeOut', delay: i * 65 });
      }
      this.betChips.push(chip);
    });
  }

  private makeChip(x: number, y: number, amount: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y).setDepth(22);
    const g = this.add.graphics();
    const cols: Record<number, number> = {
      5: 0xdc2626, 10: 0x1d4ed8, 25: 0x15803d, 50: 0xea580c, 100: 0x7c3aed,
    };
    const col = cols[amount] || 0x555555;

    g.fillStyle(0x000000, 0.25); g.fillCircle(2, 3, 34);
    g.fillStyle(col, 1);         g.fillCircle(0, 0, 34);
    g.lineStyle(3.5, 0xffffff, 0.65); g.strokeCircle(0, 0, 34);
    g.lineStyle(2,   0xffffff, 0.25); g.strokeCircle(0, 0, 25);
    for (let a = 0; a < 360; a += 45) {
      const rad = (a * Math.PI) / 180;
      g.fillStyle(0xffffff, 0.3);
      g.fillRect(Math.cos(rad) * 29 - 3, Math.sin(rad) * 29 - 3, 6, 6);
    }

    const lbl = this.add.text(0, 0, `$${amount}`, {
      fontSize: '15px', fontFamily: 'Georgia, serif',
      color: WHITE, fontStyle: 'bold', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);

    c.add([g, lbl]);
    c.setSize(72, 72);
    c.setInteractive();
    this.input.setHitArea([c], new Phaser.Geom.Circle(0, 0, 36), Phaser.Geom.Circle.Contains);
    c.on('pointerover', () => this.tweens.add({ targets: c, scaleX: 1.13, scaleY: 1.13, duration: 90 }));
    c.on('pointerout',  () => this.tweens.add({ targets: c, scaleX: 1,    scaleY: 1,    duration: 90 }));
    c.on('pointerdown', () => {
      if (!this.busy) {
        sounds.chipClick();
        this.animateChipThrow(x, y, amount);
        this.call(() => api.placeBet(amount));
      }
    });
    return c;
  }

  // ── Action buttons ─────────────────────────────────────────────────────────
  private showActionButtons(state: GameState): void {
    this.clearActionButtons();
    const hand = state.playerHands[state.activeHandIndex];
    if (!hand || hand.stood || hand.busted) return;

    const defs = [
      { label: 'HIT',    fn: () => api.hit(),    on: true },
      { label: 'STAND',  fn: () => api.stand(),  on: true },
      { label: 'DOUBLE', fn: () => api.double(),
        on: hand.cards.length === 2 && !hand.doubled && state.balance >= hand.bet },
      { label: 'SPLIT',  fn: () => api.split(),  on: this.canSplit(hand, state) },
    ].filter(d => d.on);

    const spacing = 112;
    const startX  = W / 2 - ((defs.length - 1) * spacing) / 2;

    defs.forEach((d, i) => {
      const btn = this.makeActionBtn(startX + i * spacing, BTNS_Y, d.label, () => this.call(d.fn));
      btn.setY(BTNS_Y + 55).setAlpha(0);
      this.tweens.add({ targets: btn, y: BTNS_Y, alpha: 1, duration: 240, ease: 'Back.easeOut', delay: i * 55 });
      this.actionBtns.push(btn);
    });
  }

  private showNewRoundButton(animate: boolean): void {
    const btn = this.makeActionBtn(W / 2, BTNS_Y, 'NEW ROUND', () => this.call(() => api.newRound()));
    btn.setAlpha(0);
    this.tweens.add({ targets: btn, alpha: 1, duration: 350, delay: animate ? 600 : 0 });
    this.actionBtns.push(btn);
  }

  private makeActionBtn(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const c = this.add.container(x, y).setDepth(28);
    const g = this.add.graphics();

    const drawN = () => {
      g.clear();
      g.fillStyle(0x0a1628, 0.9);  g.fillRoundedRect(-52, -23, 104, 46, 11);
      g.lineStyle(1.5, GOLD_NUM, 0.8); g.strokeRoundedRect(-52, -23, 104, 46, 11);
    };
    const drawH = () => {
      g.clear();
      g.fillStyle(0x1a3050, 0.97); g.fillRoundedRect(-52, -23, 104, 46, 11);
      g.lineStyle(2, GOLD_NUM, 1); g.strokeRoundedRect(-52, -23, 104, 46, 11);
    };

    drawN();
    const txt = this.add.text(0, 0, label, {
      fontSize: '14px', fontFamily: 'Georgia, serif', color: WHITE, fontStyle: 'bold',
    }).setOrigin(0.5);

    c.add([g, txt]);
    c.setSize(108, 50);
    c.setInteractive();
    c.on('pointerover', () => { drawH(); this.tweens.add({ targets: c, scaleX: 1.06, scaleY: 1.06, duration: 80 }); });
    c.on('pointerout',  () => { drawN(); this.tweens.add({ targets: c, scaleX: 1,    scaleY: 1,    duration: 80 }); });
    c.on('pointerdown', () => { if (!this.busy) { sounds.buttonClick(); onClick(); } });
    return c;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private canSplit(hand: PlayerHand, state: GameState): boolean {
    if (hand.cards.length !== 2 || state.balance < hand.bet || state.playerHands.length >= 4) return false;
    const v = (r: string) => ['J','Q','K'].includes(r) ? 10 : r === 'A' ? 11 : parseInt(r);
    return v(hand.cards[0].rank) === v(hand.cards[1].rank);
  }

  private clearBetChips():      void { this.betChips.forEach(b => b.destroy());    this.betChips = []; }
  private clearActionButtons(): void { this.actionBtns.forEach(b => b.destroy()); this.actionBtns = []; }

  private clearDynamicUI(): void {
    this.clearBetChips();
    this.clearActionButtons();
    this.resultLabels.forEach(t => t.destroy()); this.resultLabels = [];
    this.valueLabels.forEach(t => t.destroy());  this.valueLabels = [];
    this.dealerValText.setText('');
  }

  // ── Chip animations ─────────────────────────────────────────────────────────

  /** Throw a chip from the chip row to the center of the table when placing a bet. */
  private animateChipThrow(fromX: number, fromY: number, amount: number): void {
    const targetX = W / 2 + Phaser.Math.Between(-30, 30);
    const targetY = PLAYER_Y - CARD_HEIGHT / 2 - 50;

    const chip = this.createMiniChip(fromX, fromY, amount);
    chip.setDepth(40);

    const startX = fromX, startY = fromY;
    const arcH = 120;

    this.tweens.addCounter({
      from: 0, to: 1,
      duration: 380,
      ease: 'Cubic.easeOut',
      onUpdate: (tween) => {
        const t = tween.getValue();
        chip.x = Phaser.Math.Linear(startX, targetX, t);
        chip.y = Phaser.Math.Linear(startY, targetY, t) - Math.sin(t * Math.PI) * arcH;
        chip.scaleX = Phaser.Math.Linear(1, 0.55, t);
        chip.scaleY = Phaser.Math.Linear(1, 0.55, t);
      },
      onComplete: () => {
        // Chip stays on table briefly then fades
        this.tweens.add({ targets: chip, alpha: 0, duration: 600, delay: 400, onComplete: () => chip.destroy() });
      },
    });
  }

  /** Scrape chips toward the player (win) or toward the dealer (lose). */
  private animateChipScrape(state: GameState): void {
    const results = state.playerHands.map(h => h.result);
    const anyWin  = results.some(r => r === 'win' || r === 'blackjack');
    const anyLose = results.some(r => r === 'lose');
    const allPush = results.every(r => r === 'push');

    if (allPush) return; // no chip movement on push

    const chipCount = Phaser.Math.Clamp(Math.ceil(state.currentBet / 20), 2, 8);
    const centerY   = PLAYER_Y - CARD_HEIGHT / 2 - 50;

    for (let i = 0; i < chipCount; i++) {
      const startX = W / 2 + Phaser.Math.Between(-50, 50);
      const startY = centerY + Phaser.Math.Between(-10, 10);
      const chipVal = [5, 10, 25, 50, 100][Phaser.Math.Between(0, 4)];
      const chip = this.createMiniChip(startX, startY, chipVal);
      chip.setScale(0.55).setDepth(40).setAlpha(0);

      const targetY = anyWin ? H - 30 : 60;    // win → player, lose → dealer
      const targetX = startX + Phaser.Math.Between(-70, 70);
      const delay   = 300 + i * 90;

      this.tweens.add({
        targets: chip, alpha: 1, duration: 150, delay,
        onComplete: () => {
          sounds.chipClick();
          const sX = chip.x, sY = chip.y;
          this.tweens.addCounter({
            from: 0, to: 1,
            duration: 450,
            ease: 'Cubic.easeIn',
            onUpdate: (tween) => {
              const t = tween.getValue();
              chip.x = Phaser.Math.Linear(sX, targetX, t);
              chip.y = Phaser.Math.Linear(sY, targetY, t);
              chip.alpha = 1 - t * 0.6;
            },
            onComplete: () => chip.destroy(),
          });
        },
      });
    }
  }

  /** Create a small chip graphic for animations (not interactive). */
  private createMiniChip(x: number, y: number, amount: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const cols: Record<number, number> = {
      5: 0xdc2626, 10: 0x1d4ed8, 25: 0x15803d, 50: 0xea580c, 100: 0x7c3aed,
    };
    const col = cols[amount] || 0x555555;

    g.fillStyle(col, 1);         g.fillCircle(0, 0, 26);
    g.lineStyle(2.5, 0xffffff, 0.6); g.strokeCircle(0, 0, 26);
    g.lineStyle(1.5, 0xffffff, 0.2); g.strokeCircle(0, 0, 19);

    const lbl = this.add.text(0, 0, `$${amount}`, {
      fontSize: '11px', fontFamily: 'Georgia, serif',
      color: WHITE, fontStyle: 'bold', stroke: '#000', strokeThickness: 1.5,
    }).setOrigin(0.5);

    c.add([g, lbl]);
    return c;
  }

  // ── Sound ───────────────────────────────────────────────────────────────────
  private playResultSound(state: GameState): void {
    const results = state.playerHands.map(h => h.result);
    if (results.some(r => r === 'blackjack')) { sounds.blackjack(); return; }
    if (results.some(r => r === 'win'))        { sounds.win();       return; }
    if (results.every(r => r === 'push'))      { sounds.push();      return; }
    sounds.lose();
  }
}
