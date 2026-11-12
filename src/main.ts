import Phaser from "phaser";
import { Layout } from "./core/Layout";
import { Save } from "./core/Save";
import { Audio } from "./core/Audio";
import { Poki } from "./core/Poki";
import { Analytics } from "./core/Analytics";
import { BootScene } from "./scenes/BootScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { MenuScene } from "./scenes/MenuScene";
import { GameScene } from "./scenes/GameScene";
import { HUDScene } from "./scenes/HUDScene";
import { TutorialScene } from "./scenes/TutorialScene";
import { UpgradeScene } from "./scenes/UpgradeScene";
import { PauseScene } from "./scenes/PauseScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { GameOverScene } from "./scenes/GameOverScene";

Save.load();
Audio.setVolumes(Save.settings.sfx, Save.settings.music);
Layout.compute();

// Poki: init before loading assets (resolves even when the SDK is unavailable)
Poki.start();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: Layout.devW,
  height: Layout.devH,
  backgroundColor: "#0B0C1E",
  pixelArt: true,
  roundPixels: true,
  disableContextMenu: true,
  banner: false,
  scale: { mode: Phaser.Scale.NONE, zoom: 1 / Layout.dpr },
  input: { activePointers: 2, keyboard: true },
  render: { antialias: false, powerPreference: "high-performance" },
  fps: { target: 60, smoothStep: true },
  scene: [BootScene, PreloadScene, MenuScene, GameScene, HUDScene, TutorialScene, UpgradeScene, PauseScene, SettingsScene, GameOverScene],
});

let resizeTimer = 0;
function onResize() {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    Layout.compute();
    game.scale.setZoom(1 / Layout.dpr);
    game.scale.resize(Layout.devW, Layout.devH);
    Layout.emit();
  }, 60);
}
window.addEventListener("resize", onResize);
window.addEventListener("orientationchange", onResize);
window.visualViewport?.addEventListener("resize", onResize);
// unlock WebAudio on the first gesture anywhere
const unlock = () => Audio.unlock();
window.addEventListener("pointerdown", unlock, { capture: true });
window.addEventListener("keydown", unlock, { capture: true });
// keep the page from scrolling / zooming on mobile
document.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
document.addEventListener("gesturestart", (e) => e.preventDefault());

// handles for QA scripts (tools/qa)
Object.assign(window as unknown as Record<string, unknown>, { __game: game, __audio: Audio, __analytics: Analytics });
