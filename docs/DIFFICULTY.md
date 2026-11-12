# Difficulty curve & familiars

## The model

Every wave has a **pressure** target: enemy HP arriving per second. The spawner turns that into a
spawn interval from the wave's enemy mix and group size (`spawnIntervalMs` in `src/config/waves.ts`).
Changing the mix therefore never silently changes the difficulty.

- **Waves 1–10:** `pressure = 7 × 1.3^(wave − 1)`, a steady +30% per wave.
- **Endless (11+):** grows a gentler +15% per wave, with the Guardian boss every 10th wave.
- **Boss waves:** the adds run at 30% of normal pressure, so the Guardian is the real threat.

| Wave | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 (boss) |
|---|---|---|---|---|---|---|---|---|---|---|
| Pressure, HP/s (new) | 7 | 9 | 12 | 15 | 20 | 26 | 34 | 44 | 57 | boss + 22 |
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

The simulated player casts through the real spell system, fumbles a share of its runes, picks a
sensible spell for the situation and takes upgrade cards. Runs were capped at 8 minutes.

| Player profile | v1.2.0 | v1.3.0 |
|---|---|---|
| **Casual**: a cast every 1.8 s, 35% of runes fail | died in **wave 3** at 1:30, 2 hearts lost in wave 1 | died in **wave 8** at ~5:00, losing a heart now and then from wave 4 |
| **Moderate**: every 1.3 s, 25% fail | not measured | beat the wave 10 boss; first real damage in wave 11; alive at the 8-minute cap |
| **Expert**: every 0.95 s, 20% fail | wave 10 untouched | wave 12 untouched; endless mode keeps ramping |

Re-run after balance changes, for example:

```
QA_URL=http://localhost:5173/ node tools/qa/sim-run.mjs 480 1800 0.35   # casual
QA_URL=http://localhost:5173/ node tools/qa/sim-run.mjs 480 1300 0.25   # moderate
```

These are simulations, not people. Confirm with the `wave` start/complete/fail funnel in Poki's
analytics (see `docs/ANALYTICS.md`).
