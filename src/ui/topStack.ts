// Shared vertical layout for the top of the play screen (portrait), used by the HUD banner and the
// unlock pictogram (TutorialScene) so they can never overlap: on short screens (budget Androids at
// 360x640 @1.5x, 320x568 phones) a fixed 22% banner height landed right on the pictogram.
import { Layout } from "../core/Layout";

/** half-height of the unlock pictogram (2x icons, 32px tall) and of a 2x banner line (14px) */
const PICTO_HALF = 17, TITLE_HALF = 7, GAP = 6;

export const TopStack = {
  /** centre of the unlock pictogram, just under the wave plate and timer */
  pictoY: () => Math.round(Layout.safe.top + (Layout.portrait ? 66 : 48)),
  /** centre of the banner title: 22% down, but always below the pictogram's bottom edge */
  bannerY: () =>
    Layout.portrait
      ? Math.max(Math.round(Layout.h * 0.22), TopStack.pictoY() + PICTO_HALF + GAP + TITLE_HALF)
      : Math.round(Layout.h * 0.3),
  /** is there room for a one-line subtitle under the banner before the wizard's hat (screen centre - 46)? */
  subtitleFits: () => Layout.portrait && TopStack.bannerY() + TITLE_HALF + 8 + 7 + 4 <= Layout.h / 2 - 46,
};
