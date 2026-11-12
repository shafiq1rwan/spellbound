# Analytics events

All events go through `src/core/Analytics.ts` → `PokiSDK.measure(category, what, action)`. Poki's
reporting depends on the action:

- **`start` / `complete` / `fail`**: progress funnels. `complete` and `fail` must reuse the `start` event's category and what.
- **`visible` / `interact`**: interaction funnels.
- **Any other action**: shows the **% of gameplays that reached it**.

Milestones marked *once/run* fire at most once per run, so those percentages stay meaningful. Values
are lowercase, with no `/` or `^` (Poki reserves them), and stay stable across versions. Events sent
before the SDK is ready are queued and flushed once it is.

## Event list

| Category | What | Action | When | Questions it answers |
|---|---|---|---|---|
| `menu` | `play`, `settings` | `visible` → `interact` | Menu shown → button pressed | How many players start a game from the menu? |
| `run` | `1`, `2`, `3`, `4`, `5+` | `start` | Each run in a session | How many retries per session? |
| `run` | `quit-to-menu` | `reached` *(once/run)* | Quit from the pause menu | Do players give up mid-run? |
| `tutorial` | `intro` | `start` / `complete` / `fail` | First run only; `fail` = quit before finishing | **Do new players get through the tutorial?** |
| `tutorial` | `fail-1` … `fail-5+` | `reached` *(once/run)* | Unrecognised strokes during the tutorial | **How many attempts does the first triangle take?** |
| `wave` | `1` … `20`, `21+` | `start` / `complete` / `fail` | Wave begins / ends / player dies in it | **Where do players drop off?** |
| `boss` | `guardian` | `start` / `complete` / `fail` | Wave 10, 20, … | Is the boss too hard? |
| `rune` | `triangle`, `circle`, `zigzag`, `vee` | `visible` → `interact` *(once/run)* | Rune unlocked → first successful cast | **Do players actually use each spell once they have it?** |
| `drawing` | `misses` | `1`, `3`, `5`, `10`, `20` *(once/run)* | Running count of unrecognised strokes | How often does drawing fail? |
| `drawing` | `miss-triangle`, `miss-circle`, `miss-zigzag`, `miss-vee`, `miss-square`, `miss-unclear` | `reached` *(once/run)* | Failed stroke, labelled with the rune it most resembled | **Which rune is hardest to draw?** |
| `drawing` | `swipe` | `reached` *(once/run)* | Player drew a straight swipe (slash attack) | Do players discover / rely on swiping? |
| `swipe` | `hit` | `reached` *(once/run)* | A swipe hit at least one enemy | |
| `drawing` | `recharging`, `not-learned` | `reached` *(once/run)* | A valid rune drawn while on cooldown / before it's unlocked | Do players understand cooldowns and unlocks? |
| `death` | `slime`, `bat`, `skeleton`, `golem`, `*-elite`, `boss-orb`, `boss-beam` | `reached` | What dealt the killing blow | **What kills players?** |
| `survival` | `30s`, `60s`, `120s`, `180s`, `300s`, `600s` | `reached` *(once/run)* | Time alive in a run | Session depth |
| `familiar` | `ember-wisp`, `frost-sprite`, `spark-imp`, `arcane-owl` | `reached` *(once/run)* | Pet summoned (spell reaches level 2) | How many runs get each pet? |
| `level` | `2` … `15+` | `reached` *(once/run)* | Each level-up | Progression pace |
| `upgrade` | e.g. `spell:fireball`, `haste`, `vitality` | `picked` | Upgrade card chosen | Which upgrades are popular? |
| `combo` | `x10`, `x20`, `shatter` | `reached` *(once/run)* | Combo milestones; first Ice→other Shatter | Do players discover spell mixing? |
| `button` | `pause` | `visible` *(once/run)* → `interact` | HUD pause button | |
| `gameover` | `retry`, `menu` | `visible` → `interact` | Game-over buttons | **Do players retry after dying?** |
| `settings` | e.g. `sound-50`, `effects-low`, `calm-motion-on`, `replay-tutorial` | `selected` | Settings changed | Are defaults right? |

## Note on Poki's "Plays" column

`gameplayStart()` is called at every run start **and** on every resume (after an upgrade pick, or
after unpausing), as Poki's docs ask. The "Plays" count in playtests therefore includes resumes.
Use `run` → `start` for the real number of runs.

## Checking events locally

- In dev builds, every event prints to the console as `[analytics] category what action`.
- In any build, `window.__analytics.log` holds the last 300 events.
- `node tools/qa/events.mjs` plays a scripted first-time session and prints the event stream. Run it
  against a dev server, e.g. `QA_URL=http://localhost:5173/`.
