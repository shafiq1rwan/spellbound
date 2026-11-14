# Playtests and releases

What each Poki test measured, what changed because of it, and what to compare next. The goal is an
average session of **5 minutes or more** (Poki's own Player Fit exit criterion is over 3 minutes).

## Where things stand (14 November 2026)

| Build | State |
|---|---|
| **v1.9.1** | Player-fit done: **500 gameplays, average 6:21**, the best so far (v1.7.8: 5:17). **Web Fit Test requested with this build, unchanged** |
| **v1.7.8** | Player-fit done: 500 players, average 5:17. v1.9.x is built on it |
| **v1.8.2** | Player-fit done: 500 players, average 4:50. Lost to v1.7.8, so v1.8.0–1.8.2 are **dropped** |
| GitHub | v1.9.1 pushed to `main`; each push redeploys the GitHub Pages site. `main` stays at v1.9.1 until the Web Fit result is in |

**Web Fit Test (Poki):** about 10,000 players on poki.com over several days. Passing leads to the Final
Poki Review; failing means back to playtesting and Player Fit, and the test can be requested again with a
new version. The thumbnail can't change while it runs (`output/poki/`).

**Next, only if Web Fit passes** (one batch per test, as before):
- **Retry hooks** (roadmap step A): coins, the Spellbook shop, a goal on the game-over screen. Second runs
  are flat at 23%, and TRY AGAIN fell to 58% of game overs.
- **Or a drawing pass:** join a triangle drawn in two or three strokes, and add events that say why each
  miss failed. Half of new players still fail the tutorial triangle once.

## Results so far

### Before v1.6 (small playtests)

- Median about 3:00, average about 2:50 without the one outlier; 1 of 5 played longer than 5 minutes.
- An earlier batch of 10 sessions had a median of about 1:45: desktop sessions were all short (drawing with
  a mouse is harder, and desktop players expect to move); two mobile sessions ran 12–13 minutes.
- Poki's "Plays" column is unreliable for counting runs (see `docs/ANALYTICS.md`).

### v1.6.0 playtest (11 players)

- Average **4:16**, median **3:48**; 5 of 11 played longer than 5 minutes.
- An **early-bounce group** left between 0:55 and 2:10.
- One player reached **wave 34** after about 15 minutes. The game **froze** there (all upgrades maxed, so
  the level-up screen opened empty), **lagged** with maxed spells and pets, and effects went off screen.
  Fixed in v1.6.1–v1.6.2.
- The long sessions said the arena **all looks the same**: this is why `ROADMAP.md` plans chapters and
  new bosses.

### v1.6.2 player-fit (500 players, average 4:33)

| Stage | Players | Kept |
|---|---|---|
| Loaded → started a run | 506 → 484 | 96% (the menu loses almost no one) |
| Tutorial: trace the triangle | 469 → 426 | 91% |
| Tutorial: aim at the second slime | 425 → 402 | 95% |
| **Wave 1** | 414 → 311 | **75%**, the biggest loss |
| **Wave 2** | 302 → 241 | **80%**, the most deaths of any wave (41) |
| Waves 3–9 | | 84–94% each |
| Wave 10 boss | 97 → 81 | 84% |
| Waves 11–20 | | about 90–95% each |
| Started a second run | 100 of 484 | **21%** |

- `drawing` `not-learned` fired in **440 runs**: beginners' triangles were being read as runes they hadn't
  unlocked yet, so nothing was cast.
- `miss-vee` (387) was the most common miss, ahead of `miss-triangle` (235).
- 60% failed at least one tutorial attempt; 50 players failed five or more times.
- REVIVE was used only 5 times. Playtests may run without ads, so it's unknown whether players saw it.

**Response:** v1.6.3 fixed recognition (sloppy wave-1 triangles cast 99% of the time, up from about
70%). The simpler menu and more readable font from the same review came in v1.7.0–v1.7.2.

### v1.7.8 player-fit (500 players, average 5:17)

| Stage | Players | Kept |
|---|---|---|
| Loaded → started a run | 509 → 492 | 97% |
| Tutorial: trace the triangle | 466 → 435 | 93% |
| Tutorial: aim at the second slime | 434 → 419 | 97% |
| Wave 1 | 442 → 361 | **82%** (v1.6.2: 75%), 19 deaths |
| **Wave 2** | 354 → 265 | **75%**, the biggest loss and the most deaths of any wave (46) |
| Wave 3 | 259 → 218 | 84% |
| Waves 4–9 | | 88–93% each |
| Wave 10 boss | 109 → 97 | 89% |
| Started a second run | 109 of 492 | 22% |

Playtime: 0–1 min 90, 1–2 min **127**, 2–3 min 63, 3–4 min 35, 4–5 min 27, 5 min+ 158. The 1–2 minute
group is the tutorial plus waves 1–2.

- The v1.6.3 fix worked for what it targeted: `not-learned` no longer fires, and wave 1 rose from 75% to 82%.
- **Drawing still fails a lot:** 58% of runs missed 10+ times and 31% missed 20+. 65% of tutorial runs
  failed the traced triangle at least once (v1.6.2: 60%), 10% five or more times.
- The most common miss labels were **`miss-vee` (85% of runs)** and **`miss-circle` (83%)**, mostly before
  either rune is unlocked. A probe of the recognizer (v1.9.0 tests) found the cause: triangles left open after
  two or two-and-a-half sides read as a V and failed 70–100% of the time; triangles drawn past the start
  corner, or traced twice round as the looping ghost hand shows, read as a circle and failed 55–100%. The
  test suite had never covered either.
- `recharging` in 55% of runs, mostly Ice Nova (2.3 s; Fireball is 0.45 s). A correct circle drawn too
  early fizzled, turned red and reset the combo, like a wrong drawing.
- Many runs end mid-wave without a death: of 442 who started wave 1, 361 cleared it, 19 died, 24 were
  counted as leaving, and about 38 more just stopped (no complete, fail or leave). Waves 2 and 3: about 43
  and 28 more.
- Deaths: slime 56, bat 46, skeleton 11, boss beam 11, golem 7.
- 26% tapped twice as if to move (`cant-move-tap`). REVIVE: 2 taps in 120 game overs. TRY AGAIN: 66% of
  game overs.

### v1.8.2 player-fit (500 players, average 4:50)

v1.8.2 bundled v1.8.0 (spawns on screen behind a portal), v1.8.1 (new spawn and level-up effects) and
v1.8.2 (more monsters, from several directions at once, busier early waves). Against v1.7.8:

| Metric | v1.7.8 | v1.8.2 |
|---|---|---|
| Average playtime | 5:17 | **4:50** |
| Played under 1 minute | 90 | 108 |
| Played 5+ minutes | 158 | 142 |
| Wave 1 completion | 82%, 19 deaths | **76%, 58 deaths** |
| Wave 2 completion | 75%, 46 deaths | 80%, 26 deaths |
| Wave 3 completion | 84%, 12 deaths | 79%, 39 deaths |
| Killed by slime / bat | 56 / 46 | 90 / 74 |
| "Can't move" hint on first hit | 224 | 277 |
| Second run started | 22% | 26% (more deaths, so more retries) |

More pressure in the first waves cost more players than the extra action gained. **Decision:** drop
v1.8.0–1.8.2 and build on v1.7.8. Early-game difficulty is a strong lever, and it works in the
direction of *easier*.

### v1.9.1 player-fit (500 gameplays, average 6:21)

Built on v1.7.8 with drawing rescues, no fizzle on cooldown, slimes-only wave 2 (v1.9.0) and screen shake
off by default (v1.9.1). The playtime-by-minute chart wasn't collected for this test.

| Metric | v1.7.8 | v1.9.1 | Target | |
|---|---|---|---|---|
| Average playtime | 5:17 | **6:21** | 5:45+ | ✅ (and the roadmap's 6:00) |
| Tutorial completed | 90% (418 of 466) | **95%** (456 of 480) | | ✅ |
| `tutorial` `fail-1` | 65% | **52%** (250 of 480); 5+ fails 10% → 5% | under 40% | ⚠️ |
| Wave 1 completion | 82%, 19 deaths | **85%** (417 of 490), 18 deaths | 85%+ | ✅ |
| Wave 2 completion | 75%, 46 deaths | **82%** (338 of 410), 26 deaths | 85%+ | ⚠️ |
| Wave 3 completion | 84% | **86%** (286 of 334) | no lower | ✅ |
| Wave 4 completion | 93% | 87% (247 of 283), 7 deaths | | ⚠️ watch |
| Reached wave 10 | 22% | **28%** (147 of 516) | | ✅ |
| Survived 5 / 10 minutes | 27% / 12% | **33% / 17%** | | ✅ |
| Second run started | 22% | 23% (117 of 516) | no lower | ➖ |
| TRY AGAIN, share of game overs | 66% | 58% (73 of 125) | | ⚠️ |

- **The rescues fire in most runs:** `rescue-lap` in **83%** of runs, `rescue-close` in **67%**. Most
  players overdraw or leave their triangles open, and those strokes used to fizzle.
- **Misses are still common:** `misses-10` in 56% of runs (58% before), `miss-vee` 84%, `miss-circle` 78%.
  Runs are ~20% longer, so per minute it's probably a little better, but drawing is still the main friction.
  A likely remaining cause: triangles drawn in several strokes (each piece is read alone).
- **Wave 2 without bats:** bat deaths 46 → 21 even though more players reached later waves; wave 2 deaths
  46 → 26. Most of wave 2's remaining loss is players who stop without dying (about 45 runs, 11%).
- **No fizzle on cooldown:** combo x10 in 57% of runs (47% before), Shatter 40% (30%).
- **Screen shake off by default:** only 4 players turned it back on.
- Deaths: slime 59, skeleton 22, bat 21, boss beam 20, golem 9 (more players reach skeletons and the boss).
- `cant-move-tap` 37% (26% before) and `cant-move-hit` 187 runs (224): the hint fires once on whichever
  comes first, and with fewer early hits the tap comes first more often. It showed in about the same share
  of runs overall. REVIVE: 7 taps in 125 game overs.

## Release log

| Version | What changed | Tested on Poki |
|---|---|---|
| 1.6.0 | Guided, paused tutorial; one new spell per wave; "you can't move" hints | Playtest, 11 players |
| 1.6.1 | Late-game freeze fixed (Mastery bonus once everything is maxed), effect budgets, effects stay on screen | |
| 1.6.2 | Smoother late game; only on-screen enemies can be hit, and projectiles vanish at the screen edge | Player-fit, 500 players |
| 1.6.3 | Beginners' triangles cast reliably (only unlocked runes are considered) | |
| 1.7.0 | Readable font, cleaner upgrade cards and menu, animated loading screen | |
| 1.7.1 | Font switched to Jersey 10 (Pixelify's 5 looked like S) | |
| 1.7.2 | Evenly spaced upgrade cards | |
| 1.7.3 | Instant XP pickup, a working Screen Shake toggle, rounder icons | |
| 1.7.4 | Third-party licence notices shipped | |
| 1.7.5 | Visible screen shake, bouncing XP | |
| 1.7.6 | Level-up effect from pixelfx (replaced in 1.8.1) | |
| 1.7.7 | Rune unlock text no longer overlaps the sample drawing or a level-up | |
| 1.7.8 | Rune unlock fits small and notched phones | **Player-fit, 500 players: 5:17** |
| ~~1.8.0~~ | Enemies spawn on screen behind a 0.9 s portal, at least 140 px away (dropped) | in v1.8.2 |
| ~~1.8.1~~ | Own spawn rift and level-up pillar (dropped) | in v1.8.2 |
| ~~1.8.2~~ | More monsters at a time, from several directions at once (dropped) | Player-fit, 500 players: 4:50 |
| 1.9.1 | Screen shake off by default (also full-screen flashes and hit-stop; Settings → SCREEN SHAKE turns it on). `settings` `screen-shake-on` shows how many turn it back on | **Player-fit, 500 gameplays: 6:21.** Web Fit requested |
| 1.9.0 | **Built on v1.7.8.** Overdrawn triangles read as their first lap and open ones closed (`rescue-lap`/`rescue-close` events); a rune drawn on cooldown no longer fizzles or resets the combo; wave 2 is slimes only, bats debut in wave 3 at half weight | in v1.9.1 |

## Next lever: the retry rate

Still about 1 in 5 (22% in v1.7.8, 23% in v1.9.1), and TRY AGAIN fell from 66% to 58% of game overs in v1.9.1. Most sessions end at the first death, and many end mid-wave without one. Each retry adds a
whole run, so this may matter as much as the drawing fix. Wait for the interaction events before
building. Cheapest ideas first:

- **A goal on the game-over screen:** "2 waves to beat your best!" or "Reach wave 3 to unlock Lightning".
- **TRY AGAIN biggest and first**, with the stats smaller.
