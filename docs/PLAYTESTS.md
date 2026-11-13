# Playtests and releases

What each Poki test measured, what changed because of it, and what to compare next. The goal is an
average session of **5 minutes or more** (Poki's player-fit target).

## Where things stand (13 November 2026)

| Build | State |
|---|---|
| **v1.7.8** | Player-fit test running. **Interim: 441 players, average 5:15** (v1.6.2: 4:33) |
| **v1.8.2** | Built and ready (`release/spellbound-arena-v1.8.2.zip`): on-screen spawns, more monsters from several directions, own spawn and level-up effects; upload it **after** reading the v1.7.8 results, so each test measures one batch of changes |
| GitHub | v1.6.0 is the last push. v1.6.1 to v1.8.2 and the boss concept art are committed locally only; pushing also redeploys the GitHub Pages site |

**When the v1.7.8 results arrive, collect:**
1. The **progress events** and **other events** CSVs (as for v1.6.2).
2. The **interaction events** report (visible → interact). It shows whether players see and tap
   TRY AGAIN and REVIVE, and whether they cast each new rune after it unlocks.
3. The average playtime and number of players.

**Compare against v1.6.2:**

| Metric | v1.6.2 | A win looks like |
|---|---|---|
| Wave 1 completion | 75% (311 of 414) | 85%+ |
| Wave 2 completion | 80% | 85%+ |
| `tutorial` `fail-1` | 60% of runs | much lower |
| `drawing` `not-learned` | 440 runs | about 0 (since v1.6.3 it can't fire for a locked rune) |
| Second run started | 21% | baseline for the retry work |
| Average playtime | 4:33 | 5:00+ |

v1.7.8 bundles the drawing fix with a lot of polish. If playtime rises, the wave 1–2 and tutorial numbers
show whether the drawing fix is the reason.

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
| 1.7.8 | Rune unlock fits small and notched phones | **Player-fit, running: 5:15 at 441 players** |
| 1.8.0 | Enemies spawn on screen behind a 0.9 s portal, at least 140 px away | |
| 1.8.1 | Own spawn rift and level-up pillar (the pixelfx art didn't match the game) | |
| 1.8.2 | More monsters at a time, from several directions at once (pincers, three-way, surround) | Next to upload |

## Next lever: the retry rate

Only 1 in 5 players starts a second run, and most sessions end at the first death. Each retry adds a
whole run, so this may matter as much as the drawing fix. Wait for the interaction events before
building. Cheapest ideas first:

- **A goal on the game-over screen:** "2 waves to beat your best!" or "Reach wave 3 to unlock Lightning".
- **TRY AGAIN biggest and first**, with the stats smaller.
