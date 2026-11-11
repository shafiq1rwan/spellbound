import Phaser from "phaser";
import type { Target } from "./Enemy";

export type ProjKind = "fireball" | "missile" | "shard";

export class Projectile {
  sprite: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Image;
  kind: ProjKind = "fireball";
  active = false;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  speed = 0;
  maxSpeed = 0;
  accel = 0;
  turn = 0;
  damage = 0;
  radius = 4;
  life = 0;
  age = 0;
  pierce = 1;
  target: Target | null = null;
  hit = new Set<Target>();
  trailT = 0;
  data: Record<string, number | boolean> = {};

  constructor(scene: Phaser.Scene) {
    this.sprite = scene.add.sprite(0, 0, "fireball").setVisible(false);
    this.glow = scene.add.image(0, 0, "glow").setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
  }

  launch(kind: ProjKind, x: number, y: number, angle: number, speed: number, o: { damage: number; radius: number; life: number; tex: string; anim?: string; scale?: number; glow?: number; glowSize?: number; target?: Target | null; pierce?: number; maxSpeed?: number; accel?: number; turn?: number; data?: Record<string, number | boolean> }) {
    this.kind = kind;
    this.active = true;
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.maxSpeed = o.maxSpeed ?? speed;
    this.accel = o.accel ?? 0;
    this.turn = o.turn ?? 0;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = o.damage;
    this.radius = o.radius;
    this.life = o.life;
    this.age = 0;
    this.pierce = o.pierce ?? 1;
    this.target = o.target ?? null;
    this.hit.clear();
    this.trailT = 0;
    this.data = o.data ?? {};
    const s = this.sprite;
    s.setTexture(o.tex).setVisible(true).setActive(true).setScale(o.scale ?? 1).setAlpha(1).setPosition(x, y);
    if (o.anim) s.play(o.anim); else s.stop();
    this.glow.setVisible(o.glow !== undefined).setTint(o.glow ?? 0xffffff).setAlpha(0.55);
    const gs = o.glowSize ?? 24;
    this.glow.setDisplaySize(gs, gs);
  }

  kill() {
    this.active = false;
    this.sprite.setVisible(false).setActive(false).stop();
    this.glow.setVisible(false);
  }
}
