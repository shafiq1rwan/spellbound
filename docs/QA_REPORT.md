# QA report (2026-11-11)

All checks below were **actually executed**. Browser checks used headless Microsoft Edge driven by
`tools/qa/shoot.mjs` (playwright-core) with real pointer input. Screenshots are written to `qa-shots/`.

## Automated

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `npm test`: recognizer on 150 synthetic sloppy strokes per rune (±26° rotation, aspect changes, jitter, random start and direction, unclosed or overshooting shapes) | triangle, circle and zigzag each 150/150; V 144/150 (sloppy V's and check marks, tilted up to ±17°); carets (half-drawn triangles) read as V: 1/150; squares/rectangles cast a spell: 5/200; straight and gently curved swipes detected as swipes: 150/150 (they used to cast Fireball, or Ice Nova when neat) |
| Junk rejection (lines, hooks, random scribbles) | 7/120 accepted (threshold ≤ 25%) |
| `npm run build` | passes. Game code 126 KB (41 KB gz), Phaser 1.2 MB (332 KB gz), art about 300 KB |
| External requests in the bundle | only the Poki SDK URL |

## In-browser (screenshots inspected)

| Scenario | Viewports | Result |
|---|---|---|
| Menu | 390×844, 1280×720 | portrait and landscape layouts correct; no console errors |
| Vertical slice: triangle → fireball → slime | 360×640, 390×844, 414×896, 768×1024, 1280×720, 1920×1080 | recognised (0.95), cast animation, sigil, impact, damage number, slime splat, XP drop |
| All four spells against a mixed mob, including an elite golem | 390×844 mouse, and 390×844 at DPR 3 with **CDP touch events** | every rune recognised (0.97 to 0.99); combo counter; cooldown HUD |
| Failed scribble | 390×844 | greys out into smoke and fizzles; combo resets |
| Stress: 32 enemies, all spells at level 5 | 390×844 | no errors; 36 kills; FPS 22 to 36 under **software WebGL (SwiftShader)** |
| Level-up and upgrade cards | 390×844 | 3 cards, rarity frames, key 1 picks, game resumes |
| Boss (wave 10) | 390×844 | entry, orb volleys, summons, HP bar; drift clamped to the visible width |
| Game over, then retry | 390×844 | stats and new-best badges; retry starts a fresh run |
| Pause; tutorial first run | 390×844, 360×640 | pause overlay correct. Ghost hand draws the triangle; a real cast kills the tutorial slime; wave 1 begins |
| Autoplay bot, 90 s on real waves | 390×844 | reached wave 3, level 4, full HP, rune unlocks on schedule |
| Production build with the live Poki SDK | 390×844 | SDK loads and the game plays. Console warnings and requests come from Poki's ad stack only |
| XP orb travel (after the speed-up) | 390×844 | 60 px: 1.3 s, 100 px: 1.9 s, 150 px: 2.8 s |
| Wave 5 elite | 390×844 | guaranteed elite spawns |
| Hard human circles (open, overdrawn, egg-shaped, wobbly), 200 strokes | test suite | 199/200 recognised (the previous recognizer managed 137/200) |
| Ice → Fire Shatter (`tools/qa/ice-combo.mjs`) | 390×844 | a sloppy oval hits all 8 enemies; a fireball on a frozen enemy does double damage (50 instead of 25) |
| Loading time (`tools/qa/load-timing.mjs`) | 390×844, 4× CPU throttle, emulated 4G | menu appears at 2.6 s, down from 5.1 s (about 8.7 s originally). Requests went from 106 to 7. Sound generation runs in a worker, so loading never stalls at 100%. |
| Screen shake | 390×844, 1920×1080 | peaks 1–2 art px, then the camera returns exactly to rest |
| Guided paused tutorial, first run (`tools/qa/guided.mjs`, CDP touch) | 390×844 | slime holds still while paused; a swipe during the tutorial does no damage; traced triangle → ✓ → second slime → aimed triangle → "SURVIVE!", chain icon, "can't move" hint, wave 1 starts. Events: step-trace and step-aim start/complete |
| Menu goal card | 390×844, 360×640, 1280×720 | pictogram (triangle → fireball → skull), "DRAW SHAPES TO CAST SPELLS", chain + "YOU CAN'T MOVE - SURVIVE!" |
| Staged unlocks and "can't move" hint | 390×844 | wave 1 HUD shows only the Fire slot; wave 2 adds the Circle slot with its ghost demo; the first hit shows the binding flash, chain icon and hint (`hint cant-move-hit visible`) |
| Beginners' triangles (left open, rounded, lopsided; `tests/recognizer.test.ts`) | test suite | **Before (v1.6.2):** 70% cast Fireball; 16% rejected as a square and 12% read as the still-locked circle. **After:** the square filter needs 3 sharp corners (all wrongly rejected triangles had 2; 98% of squares have 3) and only unlocked runes are considered: 99% cast in wave 1; with all runes 86% Fireball and 99% some spell. Squares still cast only 3% (limit 8%) |
| FPS with every spell maxed and 4 pets (`tools/qa/profile.mjs`, `tools/qa/overdraw.mjs`) | 390×844 DPR 2, 4× CPU throttle | **Before:** about 13% of busy CPU time re-triangulated lightning-bolt circles every frame; glowing effects repainted 1.3 extra screens per frame on average (peak 3.6), the largest share from big glows and a full-screen flash on every lightning cast. **After:** square bolt joints (no triangulation; CPU idle 39% → 58%), glows capped at 96 px and 16 at once, the flash limited to big moments and once per 1.2 s, and faded on real time (hit-stops paused its tween, so it lingered). Overdraw 0.92 screens on average, peak 2.6. Bolts and rune trails look the same |
| On-screen rule: projectiles vanish at the screen edge, off-screen enemies take no damage | 390×844 | wave 34 stress test: 0 projectiles past the edge. Casual bot: died at the wave 10 boss at 6:24; alive in wave 12 at 7:42 |
| Late game, wave 34 (`tools/qa/endgame.mjs`): every spell Lv 5, every upgrade, all pets, casting on cooldown | 390×844, also at 6× CPU throttle | **Before:** the first level-up after every upgrade was maxed opened an empty card screen and the paused game never resumed (the tester's wave 34 freeze); 850 live particles; 13–17 projectiles flying off screen after enemies outside the view. **After:** Mastery (+6% damage, heal 1) is applied automatically with no pause; particles capped at 420 (≈410); 0–6 projectiles off view, which fizzle at the edge |

## Bugs found by QA and fixed

- The game hung on the loading bar when `PokiSDK.init()` never resolved. Init now has a 5 s timeout.
- WebGL miter joins drew spikes on sharp rune corners and in lightning. Strokes now use segments with
  round joints.
- A finger still mid-swipe could pick an upgrade card. A card now needs press and release on the same card.
- The wizard stayed white on death and the death sequence lasted about 5 s. Fixed the tint and shortened
  the slow-motion beat.
- HUD rune slots didn't refresh when levels changed outside unlock events. They now update every frame.
- Frost decal showed a scaled dither checkerboard; boss drifted off narrow portrait screens. Both fixed.
- Tutorial text wrapped and overlapped on narrow screens. The copy is shorter and the subtitle now stacks under the label's measured height.
- Vite's HTML inline-CSS proxy broke on lowercase Windows drive paths. The CSS moved to `src/style.css`.

## Not verified here (needs real hardware or accounts)

- **Real-device frame rate.** Headless tests used software rendering, so the FPS figures above are a
  pessimistic floor, not a mid-range-phone measurement.
- **Audio by ear.** Sounds are synthesised and play through WebAudio. Headless runs can't judge how they sound.
- **The official Poki Inspector.** It requires uploading to Poki's tooling. Adapter calls follow the
  documented API: init, gameLoadingFinished, gameplayStart/Stop, commercialBreak.
- **Physical touchscreens and iOS Safari safe-area insets.** The logic is implemented but was tested
  only via emulation.
