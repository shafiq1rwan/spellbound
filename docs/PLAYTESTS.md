# Playtests and releases

What each Poki test measured, what changed because of it, and what to compare next. The goal is an
average session of **5 minutes or more** (Poki's player-fit target).

## Where things stand (14 November 2026)

| Build | State |
|---|---|
| **v1.7.8** | Player-fit done: **500 players, average 5:17**. The best result so far |
| **v1.8.2** | Player-fit done: **500 players, average 4:50**. Lost to v1.7.8, so v1.8.0–1.8.2 are **dropped** |
| **v1.9.0** | Built on v1.7.8: drawing rescues for overdrawn and open triangles, no fizzle on cooldown, no bats in wave 2. **Next to upload** (`release/spellbound-arena-v1.9.0.zip`) |
| GitHub | v1.9.0 pushed to `main` (14 Nov 2026); each push redeploys the GitHub Pages site |

**Compare v1.9.0 against v1.7.8:**

| Metric | v1.7.8 | A win looks like |
|---|---|---|
| `tutorial` `fail-1` | 65% of tutorial runs (302 of 466) | under 40% |
| `drawing` `misses-10` | 58% of runs (285 of 492) | under 40% |
| `drawing` `miss-vee` / `miss-circle` | 85% / 83% of runs | much lower |
| `drawing` `rescue-lap` / `rescue-close` | (new) | how many runs a rescue saved |
| Wave 1 completion | 82% (361 of 442), 19 deaths | 85%+ |
| **Wave 2 completion** | **75%** (265 of 354), **46 deaths** | 85%+ |
| Wave 3 completion | 84% (218 of 259) | no lower |
| Second run started | 22% (109 of 492) | no lower |
| Average playtime | 5:17 | 5:45+ |

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
| 1.9.0 | **Built on v1.7.8.** Overdrawn triangles read as their first lap and open ones closed (`rescue-lap`/`rescue-close` events); a rune drawn on cooldown no longer fizzles or resets the combo; wave 2 is slimes only, bats debut in wave 3 at half weight | Next to upload |

## Next lever: the retry rate

Still about 1 in 5 (22% in v1.7.8). Most sessions end at the first death, and many end mid-wave without one. Each retry adds a
whole run, so this may matter as much as the drawing fix. Wait for the interaction events before
building. Cheapest ideas first:

- **A goal on the game-over screen:** "2 waves to beat your best!" or "Reach wave 3 to unlock Lightning".
- **TRY AGAIN biggest and first**, with the stats smaller.
