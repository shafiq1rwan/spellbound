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
import { bus } from "./core/bus";

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
Object.assign(window as unknown as Record<string, unknown>, { __game: game, __audio: Audio, __analytics: Analytics, __bus: bus });

// Safety net: Phaser schedules the next frame only after the current one returns, so an uncaught error in
// any update froze the whole game on its last image (seen in v1.9.1 on a level-up after TRY AGAIN). Catch it
// per frame, keep the loop running, and report it once per message so it shows in Poki's event data.
game.events.once(Phaser.Core.Events.PRE_STEP, () => {
  const loop = game.loop as unknown as { callback: (time: number, delta: number) => void };
  const step = loop.callback;
  const seen = new Set<string>();
  loop.callback = (time, delta) => {
    try {
      step(time, delta);
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      if (!seen.has(msg)) {
        seen.add(msg);
        console.error("[frame error]", err);
        Analytics.track("error", msg, "reached", "session");
      }
    }
  };
});
