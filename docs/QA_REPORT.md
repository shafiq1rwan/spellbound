# QA report (2026-11-11)

All checks below were **actually executed**. Browser checks used headless Microsoft Edge driven by
`tools/qa/shoot.mjs` (playwright-core) with real pointer input. Screenshots are written to `qa-shots/`.

## Automated

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `npm test`: recognizer on 150 synthetic sloppy strokes per rune (±26° rotation, aspect changes, jitter, random start and direction, unclosed or overshooting shapes) | triangle, circle and zigzag each 150/150; V 144/150 (sloppy V's and check marks, tilted up to ±17°); carets (half-drawn triangles) read as V: 1/150 |
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
