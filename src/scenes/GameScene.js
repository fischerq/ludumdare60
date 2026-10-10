import { desiredVelocity, easeVelocity } from '../systems/movement.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, PLAYER, KEYBOARD, COIN, HAZARD, UI } from '../config.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.score = 0;
    this.target = null; // {x, y} while a finger/mouse is down

    this.player = this.physics.add.image(GAME_WIDTH / 2, GAME_HEIGHT * 0.7, 'player');
    this.player.setCircle(PLAYER.radius);
    this.player.setCollideWorldBounds(true);

    this.coins = this.physics.add.group();
    this.hazards = this.physics.add.group();
    for (let i = 0; i < COIN.maxOnScreen; i++) this.spawnCoin();

    this.physics.add.overlap(this.player, this.coins, this.collectCoin, null, this);
    this.physics.add.overlap(this.player, this.hazards, this.hitHazard, null, this);

    this.hazardTimer = this.time.addEvent({
      delay: HAZARD.spawnEveryMs, loop: true, callback: this.spawnHazard, callbackScope: this,
    });

    this.scoreText = this.add.text(32, 32, 'Score: 0', {
      fontFamily: UI.fontFamily, fontSize: UI.scoreSize, color: COLORS.text, fontStyle: 'bold',
    }).setDepth(10);

    // Touch / mouse: move toward the pointer while it is held down.
    this.input.on('pointerdown', (p) => { this.target = { x: p.worldX, y: p.worldY }; });
    this.input.on('pointermove', (p) => { if (p.isDown) this.target = { x: p.worldX, y: p.worldY }; });
    // Multi-touch: when one finger lifts while another is still down, follow the remaining one.
    this.input.on('pointerup', () => {
      const held = this.input.manager.pointers.find((p) => p.isDown);
      this.target = held ? { x: held.worldX, y: held.worldY } : null;
    });

    // Pause while the tab or app is in the background, resume when it's back.
    const onHidden = () => this.scene.pause();
    const onVisible = () => { this.target = null; this.scene.resume(); };
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
    this.game.events.on(Phaser.Core.Events.VISIBLE, onVisible);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden);
      this.game.events.off(Phaser.Core.Events.VISIBLE, onVisible);
    });

    // Keyboard bonus for laptops.
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    }
  }

  update() {
    const body = this.player.body;
    let desired;

    const kx = this.keyAxis('left', 'A', 'right', 'D');
    const ky = this.keyAxis('up', 'W', 'down', 'S');

    if (kx !== 0 || ky !== 0) {
      const len = Math.hypot(kx, ky);
      desired = { x: (kx / len) * KEYBOARD.speed, y: (ky / len) * KEYBOARD.speed };
      this.target = null;
    } else {
      desired = desiredVelocity(this.player.x, this.player.y, this.target, PLAYER);
    }

    const v = easeVelocity(body.velocity, desired, PLAYER);
    body.velocity.set(v.x, v.y);

    // Clean up hazards that left the screen.
    this.hazards.children.each((h) => {
      if (h.y > GAME_HEIGHT + 100 || h.y < -200 || h.x < -200 || h.x > GAME_WIDTH + 200) h.destroy();
    });
  }

  keyAxis(negArrow, negKey, posArrow, posKey) {
    if (!this.cursors) return 0;
    const neg = this.cursors[negArrow].isDown || this.wasd[negKey].isDown;
    const pos = this.cursors[posArrow].isDown || this.wasd[posKey].isDown;
    return (pos ? 1 : 0) - (neg ? 1 : 0);
  }

  spawnCoin() {
    const x = Phaser.Math.Between(COIN.margin, GAME_WIDTH - COIN.margin);
    const y = Phaser.Math.Between(COIN.margin + 100, GAME_HEIGHT - COIN.margin);
    const coin = this.coins.create(x, y, 'coin');
    coin.setCircle(COIN.radius);
    coin.setScale(0);
    this.tweens.add({ targets: coin, scale: 1, duration: 200, ease: 'Back.Out' });
  }

  collectCoin(player, coin) {
    coin.destroy();
    this.score += COIN.points;
    this.scoreText.setText(`Score: ${this.score}`);
    this.tweens.add({ targets: this.scoreText, scale: 1.2, duration: 80, yoyo: true });
    this.spawnCoin();
  }

  spawnHazard() {
    const x = Phaser.Math.Between(HAZARD.radius, GAME_WIDTH - HAZARD.radius);
    const hazard = this.hazards.create(x, -HAZARD.radius, 'hazard');
    hazard.setCircle(HAZARD.radius);
    const speed = Phaser.Math.Between(HAZARD.minSpeed, HAZARD.maxSpeed) + this.score * HAZARD.speedUpPerPoint;
    const drift = Phaser.Math.Between(-80, 80);
    hazard.setVelocity(drift, speed);
  }

  hitHazard() {
    this.physics.pause();
    this.hazardTimer.remove();
    this.player.setTint(COLORS.hazard);
    this.cameras.main.shake(200, 0.01);
    if (navigator.vibrate) navigator.vibrate(100);
    this.time.delayedCall(500, () => this.scene.start('GameOver', { score: this.score }));
  }
}
