// Master palette for Spellbound Arena. Every asset pulls from here so pixel density,
// outlines and hue-shifted shading stay consistent. (Mirrored at runtime in src/config/palette.ts)

export const C = {
  // spec core colours
  navy: "#171B35",
  shadowPurple: "#29254A",
  outline: "#141629",
  violet: "#A77BFF",
  lavender: "#D2B5FF",
  fireOrange: "#FF914D",
  fireYellow: "#FFD36B",
  iceCyan: "#6BDDFF",
  boltYellow: "#FFE17A",
  slimeGreen: "#79D66C",
  hpRed: "#FF6478",
  xpMint: "#79E7AB",

  // extended ramps (dark -> light), hue-shifted rather than black/white
  void: "#0B0C1E",
  white: "#FFF8EC",

  hat: ["#2A1D58", "#43308F", "#6146BF", "#8C6FE6"],
  robe: ["#241C55", "#3A2F86", "#5446B3", "#7365D9"],
  gold: ["#7A4A26", "#C7862F", "#FFD36B", "#FFF2BF"],
  wood: ["#3E2420", "#6B4029", "#9A6439", "#C58E52"],
  skin: ["#B87C6E", "#F0C9A8"],
  boot: ["#2B1E33", "#4A3450"],

  crystalCyan: ["#2357B8", "#3FA4F0", "#6BDDFF", "#E4FCFF"],
  crystalFire: ["#A8321E", "#E8602A", "#FF9F4D", "#FFF0A8"],
  crystalIce: ["#3477C8", "#7FD8FF", "#C2F2FF", "#FFFFFF"],
  crystalBolt: ["#8D6A10", "#E0B526", "#FFE17A", "#FFFFFF"],
  crystalArcane: ["#6A2CA8", "#B460E8", "#E0A0FF", "#FFE8FF"],

  slime: ["#1D4A2C", "#3A8A43", "#79D66C", "#B8F08E", "#F2FFE0"],
  leaf: ["#3D7A36", "#8EDC4F"],
  blush: "#FF8FA3",

  bat: ["#1E1336", "#33215A", "#4F3784", "#7458B2", "#A08AD8"],
  batEye: ["#FF6478", "#FFD0D8"],

  bone: ["#5E5568", "#9C9183", "#D8CFB6", "#F6F0DC"],
  rust: ["#5A2A22", "#8E4A2E", "#B8703E"],
  cloth: ["#3B1F63", "#6A3BA8", "#A77BFF"],
  ghostEye: ["#A77BFF", "#E6D2FF"],

  stone: ["#221F33", "#36324C", "#4E4A68", "#6E6A8A", "#9290AD"],
  rune: ["#2D8FB8", "#6BDDFF", "#D4F8FF"],
  moss: ["#2F5A35", "#4E8A44", "#79C060"],

  // environment (kept desaturated so spells pop)
  floor: ["#14182C", "#1A1F3A", "#202643", "#272E50", "#30385C"],
  mortar: "#121528",
  dirt: ["#1A1A2C", "#24223A", "#2E2A44"],
  grass: ["#17242E", "#1F3138", "#2A4143", "#375450"],
  flowerV: ["#7D5BC9", "#C7A6FF"],
  flowerC: ["#3E8CB0", "#9BE6FF"],
  mushroom: ["#3A2B5C", "#5C3E8C", "#5FE0D0", "#C8FFF4"],

  // ui
  uiBg: ["#120F26", "#1E1838", "#2B2350"],
  uiBorder: ["#5A3E9E", "#A77BFF", "#E2CCFF"],
  uiGold: ["#8A5A22", "#D9A441", "#FFE59A"],
};
