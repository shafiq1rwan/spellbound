# Roadmap

Where Spellbound Arena goes after v1.6. The aim is more reasons to keep playing past the first few
minutes, and more variety for players who last 15+ minutes.

## Why

Playtest of v1.6.0 (11 players):
- Average session **4:16**, median **3:48**. 5 of 11 played longer than 5 minutes.
- An **early-bounce group** leaves between 0:55 and 2:10.
- The longest sessions (11:51, 16:13, one player reached wave 34) said the arena **all looks the same**.
  Waves 1 and 34 share the same arena and enemies, and the same Guardian appears at waves 10, 20 and 30.

The plan gives each run a peak about every 2.5 minutes, and a sense of arriving somewhere new
after each boss.

## Planned order

| # | Item | Targets | Size |
|---|---|---|---|
| 1 | v1.6.1: late-game freeze, effect lag, off-screen effects | Long sessions | Done, pending release |
| 2 | Mini boss on wave 5 (then every 5 waves) | The 2–4 minute drop-off | Small |
| 3 | Chapters: new arena, boss and enemy variant every 10 waves | Sameness, "what's next?" | Large |
| 4 | Endless wave modifiers | Wave 11+ variety | Small |
| 5 | Spell fusions after maxing out | Wave 25+ | Medium |
| 6 | Unlockable looks and a best-chapter record | Return visits | Small–medium |

Playtest after #2 before starting #3. It is the cheapest test of whether peaks keep players longer.

## 2. Mini bosses (every 5 waves)

Wave 5 arrives at about 2:25, right where the early-bounce group leaves. A big moment there gives
those players a goal at the right time. It must not be a difficulty wall at that point, though.

- **A spectacle more than a wall.** A big version of a known enemy with its own HP bar and one clear,
  telegraphed mechanic:
  - **King Slime:** splits into small slimes when hit hard.
  - **Bone Knight:** telegraphs a charge (a line on the floor), then rushes.
- **Other spawns drop to a trickle** during the fight, as on boss waves today (30% pressure).
- **A real reward:** it drops a chest with a free upgrade card and a heart.
- **It previews the chapter:** from Chapter 2 on, the wave 15, 25, … mini boss is the big version
  of that chapter's new enemy variant.
- **Analytics:** `miniboss` `<name>` `start` / `complete` / `fail`, to compare drop-off at wave 5
  before and after.

Art: scaled-up, recoloured versions of the existing slime and skeleton from the in-house generator
(`tools/art/`), plus a crown or helmet and the chest.

## 3. Chapters (every 10 waves)

| Waves | Chapter | Arena | Ambient | New enemy variant | Boss |
|---|---|---|---|---|---|
| 1–10 | 1 | Crypt (current) | dust, wisps | — | Ancient Guardian (current) |
| 11–20 | 2 | Frozen Ruins | snow | **Ice slime**: shrugs off Ice Nova, takes double from Fire | new boss, Frost theme |
| 21–30 | 3 | Ember Wastes | embers | **Storm bat**: splits when hit by Lightning | new boss, Fire theme |
| 31–40 | 4 | Astral Void | stars | **Armored skeleton**: only Arcane pierces the armor | new boss, Arcane theme |
| 41+ | | Cycle through the arenas with harder modifiers | | | Bosses return with new patterns |

The enemy variants make choosing a spell matter. Today the best play is to cast whatever is off
cooldown. Each variant has a single trait tied to one of the four spells.

Each boss shares the Guardian's frame (HP bar, entry, summons) with a recolour and **one new attack
pattern**. The pattern does most of the work in making it feel different.

### The transition: the world transforms around the wizard

The wizard is rooted, and players just learned "you can't move". So the wizard doesn't travel:
**the place changes around them**. This reads as "your magic conquered this place".

About 3 seconds, during the break after the boss dies:
1. **Boss dies:** slow motion, XP orbs vacuum in (this already happens).
2. **The binding circle under the wizard flares**, and the screen pulses once.
3. **A ring of light spreads outward from the wizard and repaints everything it passes.** Floor tiles
   change (crypt stone → frozen tiles), props swap (tombstones → ice crystals), ambient particles
   switch (dust → snow). Enemies left on screen dissolve as the ring touches them.
4. **Title card:** "CHAPTER 2" plus the arena name, a short music sting, and a reward: full hearts.
5. **The next wave starts** in the new arena with its new enemy variant.

Implementation: draw the new arena underneath and reveal it with a growing circular mask, then
swap props and the ambient emitter as the ring passes them. Arenas are mostly palette swaps of the
current tileset (`swap` in `tools/art/lib/px.mjs`) plus a few new props per chapter.

Alternatives considered:
- **Portal or teleport flash:** simplest, but it's a cut. It loses the "I changed this place" feeling
  and reads like a loading screen.
- **Floor collapses, you drop deeper:** dramatic, but it fights the rooted identity and costs more art.

### Rhythm

| Wave | Event |
|---|---|
| 5 | Mini boss + chest |
| 10 | Boss → arena transforms → Chapter 2 |
| 15 | Mini boss (big ice slime) |
| 20 | New boss → Chapter 3 |
| 25 | Mini boss |
| 30 | New boss → Chapter 4 |

## 4. Endless wave modifiers (wave 11+)

Some waves roll a twist, announced with a banner and a screen tint:

| Modifier | Effect |
|---|---|
| Blood Moon | Faster enemies, double XP |
| Swarm | All bats |
| Elite Hunt | Few enemies, all elites |
| Fog | Enemies are hidden until they come close |

At most one per wave, and never on boss or mini-boss waves.

## 5. Spell fusions (after maxing out)

All 32 regular upgrades run out around level 33 (usually wave 25–30). Since v1.6.1 every level after
that applies **Mastery** (+6% damage, heal 1). That fixes the freeze, but it's only a number.

Instead, once everything is maxed, unlock **fusions** cast by drawing two runes back to back:
- Fire + Ice → **Steam Burst** (blinding cloud, enemies wander)
- Lightning + Arcane → **Storm Orbs** (orbiting orbs that zap)
- Fire + Lightning, Ice + Arcane, … one per pair

Each fusion is offered as an upgrade card when it unlocks.

## 6. Reasons to come back

- **Unlockable looks** (hat and staff colours) for reaching wave 10, 20 and 30, and for the first
  win against each boss.
- **Best chapter** shown on the menu next to the best wave and time.
- Saved in the existing save data (`src/core/Save.ts`).

## Open questions

- Should a chapter's arena persist on retry ("continue from Chapter 2"), or does every run start in the Crypt?
- Does Chapter 2 also raise the difficulty, or only change the look and enemy mix?
- Is the full heal at each chapter too generous once mini-boss chests also give hearts?
