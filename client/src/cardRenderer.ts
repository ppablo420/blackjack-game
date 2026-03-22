import Phaser from 'phaser';
import { Card, Suit } from '../../shared/types';

export const CARD_WIDTH  = 104;
export const CARD_HEIGHT = 146;
const CORNER_RADIUS = 12;

const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
};

// Red suits → vivid red  |  Black suits → rich dark gold (instead of flat navy)
const SUIT_HEX: Record<Suit, string> = {
  hearts:   '#cc0808',
  diamonds: '#cc0808',
  clubs:    '#7a5800',
  spades:   '#7a5800',
};

export function createCardSprite(
  scene: Phaser.Scene,
  card: Card,
  x: number,
  y: number,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);

  if (!card.faceUp) {
    // ── Card back: dark crimson + gold branding ──────────────────────────────
    const back = scene.add.graphics();

    // Subtle drop-shadow
    back.fillStyle(0x000000, 0.28);
    back.fillRoundedRect(-CARD_WIDTH / 2 + 3, -CARD_HEIGHT / 2 + 4, CARD_WIDTH, CARD_HEIGHT, CORNER_RADIUS);

    // Body (dark crimson)
    back.fillStyle(0x5a0a0a, 1);
    back.fillRoundedRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, CORNER_RADIUS);

    // Outer gold border
    back.lineStyle(2.5, 0xffd700, 1);
    back.strokeRoundedRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, CORNER_RADIUS);

    // Inner gold border
    back.lineStyle(1, 0xffd700, 0.45);
    back.strokeRoundedRect(-CARD_WIDTH / 2 + 5, -CARD_HEIGHT / 2 + 5, CARD_WIDTH - 10, CARD_HEIGHT - 10, CORNER_RADIUS - 2);

    // Central diamond
    const diamond = scene.add.text(0, -12, '♦', {
      fontSize: '40px', fontFamily: 'serif', color: '#ffd700',
    }).setOrigin(0.5);

    // "YONI"
    const yoni = scene.add.text(0, 20, 'YONI', {
      fontSize: '17px', fontFamily: 'Georgia, serif',
      color: '#ffd700', fontStyle: 'bold', letterSpacing: 4,
    }).setOrigin(0.5);

    // "CASINO"
    const casino = scene.add.text(0, 40, 'CASINO', {
      fontSize: '11px', fontFamily: 'Georgia, serif',
      color: '#c8a000', fontStyle: 'bold', letterSpacing: 5,
    }).setOrigin(0.5);

    // Corner diamonds
    const cornerData = [
      { x: -CARD_WIDTH / 2 + 13, y: -CARD_HEIGHT / 2 + 13 },
      {  x: CARD_WIDTH / 2 - 13, y:  CARD_HEIGHT / 2 - 13 },
    ];
    const cornerPips = cornerData.map(p =>
      scene.add.text(p.x, p.y, '♦', {
        fontSize: '12px', fontFamily: 'serif', color: '#c8a000',
      }).setOrigin(0.5),
    );

    container.add([back, diamond, yoni, casino, ...cornerPips]);

  } else {
    // ── Card face: ivory + gold border ───────────────────────────────────────
    const bg = scene.add.graphics();

    // Drop-shadow
    bg.fillStyle(0x000000, 0.22);
    bg.fillRoundedRect(-CARD_WIDTH / 2 + 3, -CARD_HEIGHT / 2 + 4, CARD_WIDTH, CARD_HEIGHT, CORNER_RADIUS);

    // Ivory face
    bg.fillStyle(0xfff8ee, 1);
    bg.fillRoundedRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, CORNER_RADIUS);

    // Gold border
    bg.lineStyle(2, 0xffd700, 0.9);
    bg.strokeRoundedRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, CORNER_RADIUS);

    container.add(bg);

    const suitColor = SUIT_HEX[card.suit];
    const sym       = SUIT_SYMBOLS[card.suit];

    // Rank top-left
    const rankTL = scene.add.text(-CARD_WIDTH / 2 + 9, -CARD_HEIGHT / 2 + 7, card.rank, {
      fontSize: '22px', fontFamily: 'Georgia, serif',
      color: suitColor, fontStyle: 'bold',
    });
    container.add(rankTL);

    // Suit top-left
    const suitTL = scene.add.text(-CARD_WIDTH / 2 + 10, -CARD_HEIGHT / 2 + 32, sym, {
      fontSize: '17px', fontFamily: 'serif', color: suitColor,
    });
    container.add(suitTL);

    // Center suit (large)
    const center = scene.add.text(0, 2, sym, {
      fontSize: '50px', fontFamily: 'serif', color: suitColor,
    }).setOrigin(0.5);
    container.add(center);

    // Rank bottom-right (rotated)
    // With origin(1,1)+angle(180), text renders DOWNWARD from anchor → anchor must be
    // at least (fontSize)px above the card edge: CARD_HEIGHT/2 - 7 - 22 = CARD_HEIGHT/2 - 29
    const rankBR = scene.add.text(CARD_WIDTH / 2 - 9, CARD_HEIGHT / 2 - 29, card.rank, {
      fontSize: '22px', fontFamily: 'Georgia, serif',
      color: suitColor, fontStyle: 'bold',
    }).setOrigin(1, 1).setAngle(180);
    container.add(rankBR);

    // Suit bottom-right (rotated)
    const suitBR = scene.add.text(CARD_WIDTH / 2 - 10, CARD_HEIGHT / 2 - 52, sym, {
      fontSize: '17px', fontFamily: 'serif', color: suitColor,
    }).setOrigin(1, 1).setAngle(180);
    container.add(suitBR);
  }

  return container;
}
