// Runtime mirror of tools/art/palette.mjs (numbers for Phaser tints / graphics).
export const PAL = {
  navy: 0x171b35,
  shadowPurple: 0x29254a,
  outline: 0x141629,
  void: 0x0b0c1e,
  violet: 0xa77bff,
  lavender: 0xd2b5ff,
  fireOrange: 0xff914d,
  fireYellow: 0xffd36b,
  fireRed: 0xe8602a,
  iceCyan: 0x6bddff,
  iceBlue: 0x3b8cd8,
  boltYellow: 0xffe17a,
  boltBlue: 0x9bc4ff,
  slimeGreen: 0x79d66c,
  hpRed: 0xff6478,
  xpMint: 0x79e7ab,
  white: 0xfff8ec,
  gold: 0xffd36b,
  goldDark: 0xc7862f,
  pink: 0xff6ac1,
  arcanePink: 0xe08cff,
  grey: 0x8e89a6,
} as const;

export type Element = "fire" | "ice" | "bolt" | "arcane";

export const ELEMENT_COLORS: Record<Element, { main: number; light: number; dark: number; text: number }> = {
  fire: { main: PAL.fireOrange, light: PAL.fireYellow, dark: PAL.fireRed, text: 0xffb066 },
  ice: { main: PAL.iceCyan, light: 0xe6fcff, dark: PAL.iceBlue, text: 0x9fe8ff },
  bolt: { main: PAL.boltYellow, light: 0xfffbe0, dark: PAL.boltBlue, text: 0xfff0a0 },
  arcane: { main: PAL.violet, light: 0xf0c8ff, dark: 0x7a3cc8, text: 0xe0b0ff },
};
