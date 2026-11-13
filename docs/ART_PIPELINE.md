# Art pipeline and asset spec

## What happened with claude-pxl and PixelFX

Both repositories were cloned and inspected: READMEs, SKILL.md files, full API references, licenses and
CLI tools.

- **claude-pxl** (MIT) is a JavaScript DSL (`.px.js`) that renders sprites, animations (PNG strip plus
  Aseprite-style JSON), sheets and upscaled previews. CLI: `pxl build | serve | ascii | list`.
- **PixelFX** (MIT; parts adapted from Hugo Duprez and Hollow Crown, both MIT) is 244 code-defined
  effects. `tools/render.mjs <id> --sheet` exports a transparent PNG grid plus Aseprite JSON
  (`meta.pixelfx` holds fps and pivot). It recolours via a `palette` ramp.

**Fallback (documented change).** Running either tool's code in this environment was blocked by the
sandbox policy for executing externally downloaded code. Following the brief ("if tools cannot produce
a particular asset, create a compatible asset with programmatic pixel drawing"), the project ships its
own build-time generator in `tools/art/`. It reimplements the ideas from both tools:

| Borrowed idea | Where |
|---|---|
| pxl: one-char palette keys + grid strings, mirroring, auto-outline, palette-swap variants | `lib/px.mjs` (`grid`, `mirrorX`, `outline`, `swap`) and `enemies.mjs` (elites) |
| pxl: animation frames as parametric poses, strip + JSON with per-frame durations | `wizard.mjs`, `enemies.mjs`, `build.mjs` → `manifest.json` |
| pxl: upscaled previews to inspect every asset | `art-preview/` (generated on every build) |
| PixelFX: hard colour-ramp steps, Bayer-dithered fades, seeded randomness, white hero frame on impact | `fx.mjs` |
| PixelFX: separate additive "light" layer | runtime additive glow sprites (`VFXManager.glow`) and the baked `glow` textures |
| PixelFX: act timing (wind-up → release → freeze on contact → recovery) | wizard cast frames (45/45/70/90/110 ms), `CombatSystem` hit-stop |

No AI or tool runs at game runtime. All textures ship as PNGs inside one bundle file (176 KB).

**If the tools become runnable later**, either one can replace individual sheets. `build.mjs` only
needs a PNG grid plus a frame size and per-frame durations. Every sprite is addressed through
`manifest.json`, so swapping in a pxl or PixelFX export means adding its `frames`, `durations` and
`origin` entries.

## Regenerating art

```bash
npm run art            # node tools/art/build.mjs; deterministic, takes about 1 s
```

Outputs:
- `public/assets/gfx/gfx.json`: every texture as an embedded PNG in **one file** (176 KB, 130 KB gzipped).
  The game makes one request and decodes the textures into their usual keys at load.
- `manifest.json`: sheets, anims (frame indices, per-frame ms, repeat), origins, wizard crystal anchors,
  arena decor positions and 9-slice margins.
- `pixel.png` + `pixel.xml`: the bitmap font.
- `art-preview/`: upscaled QA previews, one per sheet.

## Shared palette (`tools/art/palette.mjs`, mirrored in `src/config/palette.ts`)

| Core | Hex | | Core | Hex |
|---|---|---|---|---|
| Dark navy | `#171B35` | | Ice cyan | `#6BDDFF` |
| Shadow purple | `#29254A` | | Lightning yellow | `#FFE17A` |
| Outline | `#141629` | | Slime green | `#79D66C` |
| Magical violet | `#A77BFF` | | HP red | `#FF6478` |
| Bright lavender | `#D2B5FF` | | XP mint | `#79E7AB` |
| Fire orange | `#FF914D` | | Fire yellow | `#FFD36B` |

Each material has a hue-shifted ramp of 3 to 5 steps (hat, robe, gold, wood, crystal ×5 elements, slime,
bat, bone, rust, stone, rune, moss, floor, grass and UI). The floor ramp is deliberately dark and
desaturated so spells stay the strongest visual element.

## Asset spec (as built)

| Asset | Canvas | Frames / anims | Notes |
|---|---|---|---|
| Wizard | 48×48 | idle 4, blink 4, cast 5, hurt 2, cheer 2, death 4 | Feet at (24, 44.5). 37 px tall. Light from upper-left. Hat tip lags as secondary motion. |
| Floating crystal | 9×10 | 4-frame pulse × 5 elements | Follows per-frame staff anchors exported in the manifest. |
| Forest Slime | 32×32 | idle 4, hop 6, hurt 2, death 3 | Squash/stretch hop; the leaf sways; blush cheeks. |
| Shadow Bat | 32×32 | fly 4, hurt 2 | Oversized ears and wings, pink-red eyes. |
| Cursed Skeleton | 48×48 | idle 2, walk 4, attack 3, hurt 1 | Square skull, one glowing eye, rusty sword, purple loincloth. Bone bits for the death scatter. |
| Stone Golem | 64×64 | idle 4, walk 4, attack 4, hurt 1 | Cyan rune, moss, oversized fists. Rock bits for the death. |
| Elites | same | same | Palette swap plus a 1 px glowing rim, ×1.2 scale at runtime, aura and motes, attack flash. |
| Arcane Guardian (boss) | 96×96 | idle 4, charge 2, hurt 1 | Detached hands (24×24), 3 orbiting fragments, orb projectile (14×14). |
| Arena floor | 640×640 | — | Paved plaza, inlaid rune circle, ruined walls, pillar stumps, rubble, mushrooms, flowers, dithered vignette. |
| VFX | various | fireball, meteor, explosion ×2, frost nova, missile, starburst, vortex, hit flash, zap, smoke, portal, shock rings, XP gems, 5 element sigils | Plus particles, decals, glows and shadows. |
| UI | — | 5×7 font (BMFont), logo, 9-slice panels/buttons/cards, hearts, 16×16 icons (incl. `ic_gear`) | Readable text uses Pixelify Sans (SIL OFL 1.1, `public/assets/fonts/`), not generated |

## QA process used

Each asset was rendered, then inspected as an upscaled preview, then inspected at gameplay size over
the real floor, then revised. Revisions made this way:
- A stronger hat bend for the silhouette.
- Golem legs reattached and arms anchored to the shoulders.
- Bat wing contrast and wider ears.
- Skeleton blade recoloured as steel.
- Plaza contrast reduced twice.
- Explosion silhouette made irregular instead of a pentagon.
- Frost-nova interior changed from a screen-door dither to sparse glints.
- Perspective rings re-rasterised gap-free.
- The frost decal rebuilt so it no longer shows a scaled dither checkerboard.
