import Phaser from 'phaser';
import { BlackjackScene } from './scenes/BlackjackScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: document.body,
  backgroundColor: '#0d1b35',
  antialias: true,
  antialiasGL: true,
  roundPixels: true,
  scene: [BlackjackScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
};

new Phaser.Game(config);
