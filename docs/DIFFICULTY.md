# Difficulty curve & familiars

## The model

Every wave has a **pressure** target: enemy HP arriving per second. The spawner turns that into a
spawn interval from the wave's enemy mix and group size (`spawnIntervalMs` in `src/config/waves.ts`).
Changing the mix therefore never silently changes the difficulty.

- **Waves 1–10:** `pressure = 9 × 1.33^(wave − 1)`, a steady +33% per wave (all four runes work from wave 1).
- **Endless (11+):** grows a gentler +15% per wave, with the Guardian boss every 10th wave.
- **Boss waves:** the adds run at 30% of normal pressure, so the Guardian is the real threat.

| Wave | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 (boss) |
|---|---|---|---|---|---|---|---|---|---|---|
| Pressure, HP/s (v1.4) | 9 | 12 | 16 | 21 | 28 | 38 | 50 | 66 | 88 | boss + 34 |
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

| Player profile | v1.2.0 | v1.3.0 | v1.4.0 (all runes from wave 1) |
|---|---|---|---|
| **Casual**: a random rune every 1.8 s, 35% fail | (smart bot) died in **wave 3** at 1:30 | (smart bot) died in wave 8 at ~5:00 | loses hearts in waves 2–3 while learning, recovers, dies at the **wave 10 boss at 6:42** |
| **Moderate**: smart, every 1.3 s, 25% fail | — | beat the wave 10 boss | wave 12+ untouched; endless keeps ramping |

v1.4 balance notes:
- With all runes from wave 1, spell rotation kept the combo maxed, so the combo bonus is now +2.5% per stack (max +50%).
- Ice Nova level 1 freezes for 1.1 s on a 2.3 s cooldown (was 1.5 s on 2.0 s).

Re-run after balance changes, for example:

```
QA_URL=http://localhost:5173/ node tools/qa/sim-run.mjs 480 1800 0.35 0   # casual (random runes)
QA_URL=http://localhost:5173/ node tools/qa/sim-run.mjs 480 1300 0.25 1   # moderate (smart)
```

These are simulations, not people. Confirm with the `wave` start/complete/fail funnel in Poki's
analytics (see `docs/ANALYTICS.md`).
