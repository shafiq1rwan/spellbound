# Spellbound Arena

Portrait-first pixel-art survival shooter for Poki. You draw runes with a finger or the mouse to cast
spells at monsters closing in from every side.

| Rune | Spell | Role |
|---|---|---|
| Triangle | **Fireball** | Single-target projectile with splash. At level 3 it splits into 3; at level 5 it becomes a meteor. |
| Circle | **Ice Nova** | Big ring centred on the wizard: damages, freezes and pushes foes back from level 1 (shards from level 3, a double pulse at 5). |
| Zigzag | **Lightning Chain** | Instant bolt that jumps between enemies. Stuns from level 3; every bolt forks at level 5. |
| V (or ✓) | **Arcane Barrage** | A homing missile for each nearby enemy, with knockback. Pierce from level 3; summons a vortex at level 5. |

**One new spell per wave:** Fireball from the start, then Ice Nova (wave 2), Lightning (wave 3) and
Arcane (wave 4). The HUD shows only the spells you have, and each unlock plays a short ghost demo.
**The wizard is rooted:** you can't move. The menu says so on its goal card, a binding circle sits under
the wizard, and a chain hint appears on the first hit (or when a player keeps tapping to move).
**Guided first run, world paused:** a frozen slime with a dashed triangle to trace (a ghost hand shows
how), then a second slime to aim at, then "SURVIVE!" and wave 1. Nothing attacks until both casts land.
**Swipe:** a straight line through monsters is a light slash, a basic attack that needs no rune (off
during the guided tutorial).
**Onboarding is wordless** (pictograms, ghost hand, ✓/✗) so it works in any language.
**Revive:** once per run, the game-over screen offers 🎬 REVIVE through a Poki rewarded ad. It restores
3 hearts, throws nearby enemies back, and the run continues. It only appears when an ad can be offered.
**Familiars:** a spell's first upgrade (level 2) summons an elemental
pet (Ember Wisp, Frost Sprite, Spark Imp, Arcane Owl) that auto-casts a weaker version of the spell.
Difficulty rises a steady ~28% per wave (see `docs/DIFFICULTY.md`). **Spell combination:** freeze enemies with Ice Nova, then hit them with any other spell to
*shatter* them for double damage. Switching elements also builds the combo meter 3× faster than
repeating one spell. **Aiming:** draw the rune on top of a monster to target it.
Otherwise the spell goes for the nearest enemy.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + production build to dist/
npm run preview      # serve dist/
npm test             # rune recognizer tests (node --test)
npm run art          # re-bake every sprite sheet into public/assets/gfx
```

Requires Node 22.18+ (the art tools and tests use Node's native TypeScript stripping).

**Poki SDK.** The SDK loads by default. Set `VITE_POKI=off` (for example
`VITE_POKI=off npm run dev`) to skip it during local QA.

**Upload to Poki.** Run `npm run release`. It builds with the Poki SDK and writes
`release/spellbound-arena-v<version>.zip` (version from `package.json`, `index.html` at the zip root).
All paths are relative (`base: "./"`).

## Controls

- **Mobile:** touch, drag and release anywhere on the arena. Tap a rune slot to see how to draw it.
- **Desktop:** left mouse button, drag and release.
- **Keyboard (optional):** Enter/Space starts a run from the menu, Esc/P closes the pause menu,
  1, 2 and 3 pick upgrade cards, and Enter retries from the game-over screen.

## Project layout

```
src/
  main.ts                  game bootstrap, resize/orientation handling, audio unlock
  config/                  ALL balancing data: game.ts, spells.ts, enemies.ts, waves.ts, upgrades.ts, palette.ts
  core/                    Layout (responsive pixel scale), Audio + synth, Save, Poki adapter, assets, event bus
  rune/                    RuneRecognizer ($1 + feature gates), RuneInput (pointer capture), RuneDrawingRenderer
  entities/                Wizard, Enemy (slime/bat/skeleton/golem/orb), Boss, Projectile
  systems/                 SpellManager, CombatSystem, VFXManager, EnemySpawnManager, XPSystem, UpgradeManager, Ambience
  scenes/                  Boot, Preload, Menu, Game, HUD, Tutorial, Upgrade, Pause, Settings, GameOver
  ui/                      pixel widgets (buttons, 9-slice panels, text), segment stroker
tools/art/                 build-time pixel-art generator (see docs/ART_PIPELINE.md)
tools/qa/shoot.mjs         headless-Edge QA driver (screenshots, scripted rune drawing, stress)
tests/                     recognizer test suite
public/assets/gfx/         baked PNG sheets + manifest.json (+ bitmap font)
```

## Tuning

- **Recognizer:** `GAME.rune.threshold` and `strongThreshold` in `src/config/game.ts`. Turn on
  Settings → **Rune Debug** to see live scores, closure, turning and corner counts for every stroke.
- **Spells:** each level's stats and description live in `src/config/spells.ts`.
- **Enemies and waves:** `src/config/enemies.ts` and `src/config/waves.ts`. Waves 1 to 10 are authored
  (boss on wave 10). After that, waves scale endlessly with a boss every 10th wave.
- **Game feel:** the hit-stop and shake values are in `GAME.feel`; XP pull speeds are in `GAME.xp`.
- **Effect budgets** (`src/systems/VFXManager.ts`): at most 420 live particles (× quality), 16 big
  glows (each at most 96 art px across), 24 lightning bolts and 32 sprites per effect type; 60 XP orbs
  (`XPSystem`). The full-screen flash fires at most once every 1.2 s (meteor, boss, level-up, getting
  hurt). If the frame rate drops under 45, effect density steps down automatically (to 35%) and
  recovers above 56. Bolts and rune trails use square joints (`src/ui/stroke.ts`) because Phaser
  re-triangulates every `fillCircle` each frame.
- **Only what's on screen gets hit** (like Survivor.io): auto-aim, chains, homing and pets pick on-screen
  enemies (`GameScene.visibleTargets`), projectiles vanish at the screen edge, and `CombatSystem`
  ignores damage to anything whose centre is off screen.
- **Spawns** come from the four screen edges with equal odds (`EnemySpawnManager.edgePoint`). In
  portrait the side edges are close to the wizard, so spawning by edge length sent most enemies in
  from the sides with little warning.

Gameplay analytics (Poki `measure` events): see `docs/ANALYTICS.md`.

See `docs/ART_PIPELINE.md` for how the art is made and `docs/QA_REPORT.md` for what was verified.
