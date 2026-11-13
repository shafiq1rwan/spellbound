# Difficulty curve & familiars

## The model

Every wave has a **pressure** target: enemy HP arriving per second. The spawner turns that into a
spawn interval from the wave's enemy mix and group size (`spawnIntervalMs` in `src/config/waves.ts`).
Changing the mix therefore never silently changes the difficulty.

- **Waves 1–10:** `pressure = 7 × 1.28^(wave − 1)`, a steady +28% per wave. One new spell per wave: Ice Nova at wave 2, Lightning at 3, Arcane at 4.
- **Endless (11+):** grows a gentler +15% per wave, with the Guardian boss every 10th wave.
- **Boss waves:** the adds run at 30% of normal pressure, so the Guardian is the real threat.

| Wave | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 (boss) |
|---|---|---|---|---|---|---|---|---|---|---|
| Pressure, HP/s (v1.6) | 7 | 9 | 11.5 | 15 | 19 | 24 | 31 | 40 | 51 | boss + 19 |
| Pressure, HP/s (v1.4–1.5, all runes from wave 1) | 9 | 12 | 16 | 21 | 28 | 38 | 50 | 66 | 88 | boss + 34 |
| Pressure, HP/s (v1.2 and earlier) | 12 | 20 | 29 | 46 | 79 + elite | 110 | 153 | 186 | 272 | |

Other tuning in this pass:
- Golems arrive at wave 6 with 140 HP (was wave 5, 170 HP).
- Elites have 2.5× HP (was 3.5×).
- Clearing a wave heals 1 heart (`GAME.healOnWaveClear`).

## Familiars

Reaching **level 2** of a spell summons its familiar. Pets sit beside the wizard and auto-cast a
weaker version of their spell, getting stronger as the spell levels up. Values are in
`src/systems/FamiliarSystem.ts`.

| Spell | Familiar | Auto-attack | Cooldown (spell Lv 2 → 5) | Share of the spell's damage |
|---|---|---|---|---|
| Fireball | Ember Wisp | small homing fireball | 2.0 → 1.55 s | 30 → 42% |
| Ice Nova | Frost Sprite | chill pulse around the wizard (slows; brief freeze from Lv 4) | 3.4 → 2.7 s | 22 → 34% |
| Lightning | Spark Imp | zap the nearest foe (chains once from Lv 4) | 2.3 → 1.8 s | 30 → 42% |
| Arcane | Arcane Owl | one homing missile | 2.0 → 1.55 s | 60 → 80% |

Pets add damage that doesn't depend on drawing speed. Drawing stays the main source of damage.

## Measured with `tools/qa/sim-run.mjs`

The simulated player casts through the real spell system and fumbles a share of its runes. "Smart"
bots pick the best spell for the situation; the casual bot draws a random known rune, as a new
player does. Runs are capped at 8 minutes.

| Player profile | v1.2.0 | v1.3.0 | v1.4.0 (all runes from wave 1) | v1.6.0 (one new spell per wave) |
|---|---|---|---|---|
| **Casual**: a random rune every 1.8 s, 35% fail | (smart bot) died in **wave 3** at 1:30 | (smart bot) died in wave 8 at ~5:00 | loses hearts in waves 2–3 while learning, recovers, dies at the **wave 10 boss at 6:42** | dies at the **wave 10 boss at 6:03**, losing only a heart or two before it |
| **Moderate**: smart, every 1.3 s, 25% fail | — | beat the wave 10 boss | wave 12+ untouched; endless keeps ramping | beats the boss; alive in wave 12 at 7:36 |

v1.6: spells unlock one per wave again (players found all four at once overwhelming). With v1.5's
pressure (9 × 1.33) and staged unlocks, the casual bot died in **wave 3 at 1:41**, matching the playtest
drop-off under 1:30. The curve was lowered to 7 × 1.28.

v1.5: early levels need less XP (3, 6, 11, 19, 28; was 8, 13, 19, 25, 32). The first upgrade and pet
arrive about 11 s into wave 1. The casual bot no longer loses hearts early, and still dies at the wave 10
boss (6:13). The bots never use the rewarded revive, which adds time for real players.

v1.4 balance notes:
- With all runes from wave 1, spell rotation kept the combo maxed, so the combo bonus is now +2.5% per stack (max +50%).
- Ice Nova level 1 freezes for 1.1 s on a 2.3 s cooldown (was 1.5 s on 2.0 s).

## v1.6.1: on-screen auto-aim and spawn sides

Auto-aim now ignores enemies outside the screen (the playtest saw bolts and explosions off screen).
In portrait that cost the casual bot defence, because 2/3 of spawns came from the close left/right
edges and used to be shot before they appeared. Spawns are now split evenly across the four edges.

| Casual bot, 3 runs each | Results |
|---|---|
| v1.6.0 | 3:45, 6:03, alive at 7:44 |
| On-screen aim only | 2:20, 2:46, 6:44 |
| v1.6.2: nothing off screen can be hit | 6:24 (wave 10 boss), alive at 7:42 |
| v1.7.3: XP flies straight in | 5:14 (wave 9), level 11; within the usual spread |
| On-screen aim + even spawn sides (v1.6.1) | 4:20, 6:29 (wave 10 boss, run alone), alive at 7:44; plus 1:26 in a run that shared the CPU with two other browsers |

The casual bot's spread is wide (it tends to get surrounded and collapse), so compare medians over
several runs.

## Late game

All 29 regular upgrades (4 spells × 4 levels, plus haste, vitality, power and wisdom; Soul Magnet was removed in v1.7.3 when XP started flying straight to the wizard) run out
around level 33. After that every level-up applies **Mastery** automatically: +6% spell damage and
1 heart, with no pause. Before v1.6.1 the level-up screen opened empty and the game froze.

`tools/qa/endgame.mjs [wave] [seconds] [cpuThrottle]` loads that state and logs frame rate, live
particles, tweens, on/off-screen enemies and projectiles.

Re-run after balance changes, for example:

```
QA_URL=http://localhost:5173/ node tools/qa/sim-run.mjs 480 1800 0.35 0   # casual (random runes)
QA_URL=http://localhost:5173/ node tools/qa/sim-run.mjs 480 1300 0.25 1   # moderate (smart)
```

These are simulations, not people. Confirm with the `wave` start/complete/fail funnel in Poki's
analytics (see `docs/ANALYTICS.md`).
