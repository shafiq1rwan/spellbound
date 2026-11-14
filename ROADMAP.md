# Roadmap

**Goal:** an average session of **6 minutes** in Poki's player-fit test (v1.6.2: 4:33; v1.7.8: 5:17; **v1.9.1: 6:21, reached**). Test results,
the release log and what's on Poki now are in `docs/PLAYTESTS.md`.

## Plan

One batch of changes per Poki test, so each test shows what moved the numbers. Every batch adds
analytics events for its features.

| Step | What | Targets | Size |
|---|---|---|---|
| 0 | **Web Fit Test with v1.9.1, unchanged** (Player Fit 6:21). The steps below start only if it passes | Pass Web Fit → Final Poki Review | — |
| **A** | Coins, the Spellbook shop, a goal on the game-over screen, the first robe colours | Retry rate (23% start a 2nd run in v1.9.1) | Medium |
| **B** | Crates with drops, the wave 5 mini boss and its chest | Players lost a few % every wave in waves 3–9 | Medium |
| **C** | Element loadout with **Wind** and **Earth** | Variety, "learn new magic" | Medium–large |
| **D** | Chapter 2: Frozen Ruins, the transition, the Rime Queen | Waves 10–20, "it all looks the same" | Large |
| Later | Chapters 3–4, more elements, wave modifiers, spell fusions, more cosmetics | Long sessions, return visits | — |

## A. Coins and the Spellbook shop

The strongest retry hook in this genre: "35 more coins for Meteor Shower" makes players start another run.

- **Coins** drop from enemies, plus a bonus for each wave cleared. They're saved between runs.
- **No real money.** As far as we know, Poki doesn't support in-app purchases (check with Poki). A
  **rewarded ad** can let players try a spell for one run.
- **Price the first item so it's affordable after about 2 runs** (for example, a 4-minute run earns
  about 60 coins and the cheapest spell costs 100). The first run sets the goal; the second buys it.
- **Bought spells play differently; they aren't stronger.** Otherwise grinding makes the game easy.
- **The game-over screen shows a goal:** progress to the next shop item, or an unlock such as "Reach wave 5
  to unlock the Ember robe". Make TRY AGAIN the biggest button.
- Start with the shop, the goal, two spells (Meteor Shower and Black Hole are the most eye-catching) and
  3–4 robe colours.

Spells for sale replace what an existing rune casts. **No new shapes:** each new rune makes recognition
harder, and drawing failures were the biggest loss in v1.6.2.

| Rune | Starting spell | Spells to buy |
|---|---|---|
| Triangle | Fireball | Meteor Shower (meteors rain on a spot), Firework (splits into sparks) |
| Circle | Ice Nova | Frost Wall (a ring that blocks enemies), Blizzard (slows the whole screen) |
| Zigzag | Lightning | Thunderstorm (random strikes for 3 s), Ball Lightning |
| V | Arcane Barrage | Void Lance (pierces in a line), Black Hole (pulls enemies in) |

Analytics: `coins` earned per run, `shop` opened, `buy` `<item>`, `trial` `<spell>` (ad), and goal shown
→ retry.

## B. Drops and mini bosses

**Crates.** The wizard can't move, so drops come in crates that you break with any spell. Each drop is a
drawing moment. One crate is guaranteed in wave 2 (the wave with the most deaths); after that, elites drop
them.

| Drop | Effect |
|---|---|
| Shield bubble | Blocks the next 2 hits |
| Heart | +1 heart |
| Bomb | Blasts everything on screen |
| Magnet | Pulls in all XP on the floor |
| Frenzy | Spells recharge twice as fast for 8 s |

**Mini boss on wave 5** (then every 5 waves). Wave 5 comes at about 2:25, where many players leave. It
should be a spectacle, not a difficulty wall:
- A big version of a known enemy with its own HP bar and one telegraphed mechanic. **King Slime** splits
  into small slimes when hit hard; **Bone Knight** marks a line on the floor, then charges.
- Other spawns drop to a trickle during the fight, as on boss waves.
- It drops a **chest** with a free upgrade card and a heart.
- From Chapter 2 on, the mini boss is the big version of that chapter's new enemy.

Analytics: `crate` `<drop>`, `miniboss` `<name>` `start` / `complete` / `fail`.

## C. Elements and the loadout

New elements are chosen **before a run**: four are equipped, one per rune. The triangle casts Fire or
Earth depending on the loadout, so there are still only four shapes to draw.

Each element needs its own job and a combo with the others; otherwise it's just a recolour. The game
already rewards switching elements (the combo meter builds 3× faster; Ice then Fire shatters).

| Element | Rune | Job | Combo |
|---|---|---|---|
| **Wind** | Circle | A tornado that drags enemies in, or a gust that pushes them back | Wind + Fire = firestorm |
| **Earth** | Triangle | A boulder or ground spikes: slow, huge damage, stuns | Shatters frozen enemies harder |
| Star | V | Falling stars on random enemies; some hits are lucky crits | Marked enemies take more from other spells |
| Water | Zigzag | A wave that soaks enemies | Soaked + Lightning = double damage |
| Holy | V | A beam that sometimes heals 1 heart | Double damage to skeletons |
| Shadow | Triangle | A lifesteal bolt | Darkness makes enemies wander |

Start with **Wind and Earth**: they play the most differently from the current four. Each element is
about 1–2 days (effects art in `tools/art/fx.mjs`, logic, upgrades).

**Passive spells** are another way to learn new magic without drawing: upgrade cards such as a fire ring
orbiting the wizard, a frost aura that slows enemies nearby, a thunder strike every 5 s or a recharging
shield.

## Cosmetics

Generated in code, so they're cheap. They mainly bring players back on other days; for the first session
(what player-fit measures), only the "unlock at wave N" goal helps. So start small (step A) and grow
the collection after passing.

| Cosmetic | Examples |
|---|---|
| Robe and hat colours | Ember (red and gold), Frost (white and cyan), Forest (green), Void (black and violet) |
| Staff crystals | Star, moon, flame, skull |
| Rune ink (the stroke you draw) | Gold, rainbow, fire trail, ghostly |
| Floor circles | Rune ring, star circle, flower circle |
| Pet skins (later) | Ember Wisp as a little dragon, Arcane Owl as a cat |

Unlocked by goals (reach wave 5, 10 or 20, beat the Guardian, shatter 100 enemies) or bought with coins.
Saved in `src/core/Save.ts`.

## D. Chapters: a new place every 10 waves

| Waves | Place | Ambient | New enemy | Boss |
|---|---|---|---|---|
| 1–10 | Crypt (current) | dust, wisps | — | Ancient Guardian (current) |
| 11–20 | Frozen Ruins | snow | Ice slime: shrugs off Ice, takes double from Fire | Rime Queen |
| 21–30 | Ember Wastes | embers | Storm bat: splits when hit by Lightning | Cinder Maw |
| 31–40 | Astral Void | stars | Armoured skeleton: only Arcane pierces it | Void Weaver |
| 41+ | The places cycle with harder modifiers | | | Bosses return with new patterns |

- **Enemy variants** make the choice of spell matter. Today the best play is whatever is off cooldown.
- **Bosses** share the Guardian's frame (HP bar, entry, summons) with one new attack pattern each.
  Concept art: `tools/art/bosses.mjs` (96×96, animated). Run `node tools/art/boss-preview.mjs`, then open
  `tools/art/boss-preview.html`. Not wired into `build.mjs` yet.
- **A chapter could unlock an element** (beat the Guardian, learn Wind), giving a goal beyond the shop.

**The transition (about 3 s, after the boss dies).** The wizard is rooted, so the place changes around them
instead of teleporting:
1. Slow motion and the XP vacuum (already in the game).
2. The binding circle flares; the screen pulses once.
3. A ring of light spreads out from the wizard and repaints what it passes: stone → frozen tiles,
   tombstones → ice crystals, dust → snow. Leftover enemies dissolve.
4. "CHAPTER 2: FROZEN RUINS" title card, a music sting, hearts refilled.
5. The next wave starts with the new enemy.

Build it by drawing the new arena underneath and revealing it with a growing circular mask. Arenas are
mostly palette swaps of the current tileset (`swap` in `tools/art/lib/px.mjs`) plus a few props each.

**Rhythm:** a peak about every 2.5 minutes. Mini boss at wave 5, the boss and Chapter 2 at 10, mini boss
at 15, the boss and Chapter 3 at 20, and so on.

## Later

- **Wave modifiers (wave 11+),** at most one per wave, never on boss waves: Blood Moon (faster enemies,
  double XP), Swarm (all bats), Elite Hunt (few enemies, all elites), Fog (enemies hidden until close).
- **Spell fusions** once every upgrade is maxed (around wave 25–30, where Mastery takes over today): draw
  two runes back to back, e.g. Fire + Ice → Steam Burst, Lightning + Arcane → Storm Orbs. Offered as
  upgrade cards.
- **Best chapter** on the menu next to the best wave and time.

## Ideas on hold

- **Revive animation.** Today the wizard pops back in one frame, then a gold shockwave pushes enemies
  back. Idea (about 1 s, game frozen, mirroring the death dissolve): sparkles gather in, the level-up
  pillar bursts up while the wizard fades in from a white silhouette, and the crystal floats back to the
  staff. Then the shockwave.
- **Stronger shake for other spells.** Only Fireball's shake is really felt. Suggested: Ice Nova 2.5 px for
  160 ms, Lightning 2.5 px for 140 ms (more when it chains to 3+), Arcane a 1 px tick on a missile kill.
- **Sprite Fusion pilot** (spritefusion.com pixel-art generator, MCP server): exact sizes, a saved palette,
  style matching from up to 20 reference images, animation. Unknowns: the animation export format,
  transparency, the commercial licence, and cost (15 credits a call). Pilot: generate the King Slime at
  64 px in the game's style and compare it with a code-drawn one. It has to be connected in Claude Code
  first (`claude mcp add`, then sign in with `/mcp`).

## Open questions

- Should elements be bought, unlocked by beating a chapter boss, or both?
- Does a retry continue from the chapter reached, or does every run start in the Crypt?
- Does Chapter 2 raise the difficulty, or only change the look and the enemy mix?
- Is a full heal at each chapter too generous once mini-boss chests and crates also give hearts?
