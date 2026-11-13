// Assets that aren't needed to start playing, loaded in the background once the menu is up so they
// don't lengthen the loading screen. Code that uses them checks lateReady() and has a fallback.
//
// fx_levelup: pixelfx "ui/level-up" (MIT, https://github.com/patch-gg/pixelfx), imported by
// tools/art/import-pixelfx.mjs. 49 frames of 176x138 at 15 fps, pivot at the hero's feet (88, 114).
import Phaser from "phaser";

export const LEVELUP_FX = { key: "fx_levelup", anim: "fx_levelup:play", frameW: 176, frameH: 138, frames: 49, fps: 15, pivot: [88, 114] as const };

/** start (or resume) loading the late assets on this scene's loader; safe to call repeatedly */
export function loadLateAssets(scene: Phaser.Scene) {
  if (scene.textures.exists(LEVELUP_FX.key)) return ensureAnims(scene);
  const L = scene.load;
  L.spritesheet(LEVELUP_FX.key, "assets/fx/levelup.png", { frameWidth: LEVELUP_FX.frameW, frameHeight: LEVELUP_FX.frameH, endFrame: LEVELUP_FX.frames - 1 });
  L.once(`filecomplete-spritesheet-${LEVELUP_FX.key}`, () => ensureAnims(scene));
  if (!L.isLoading()) L.start();
}

function ensureAnims(scene: Phaser.Scene) {
  if (scene.anims.exists(LEVELUP_FX.anim) || !scene.textures.exists(LEVELUP_FX.key)) return;
  scene.anims.create({
    key: LEVELUP_FX.anim,
    frames: scene.anims.generateFrameNumbers(LEVELUP_FX.key, { start: 0, end: LEVELUP_FX.frames - 1 }),
    frameRate: LEVELUP_FX.fps,
    repeat: 0,
  });
}

export function lateReady(scene: Phaser.Scene) {
  return scene.textures.exists(LEVELUP_FX.key) && scene.anims.exists(LEVELUP_FX.anim);
}
