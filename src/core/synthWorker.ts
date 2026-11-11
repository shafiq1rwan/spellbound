// Background audio synthesis: renders every SFX (UI sounds first) and the music loop off the main
// thread, posting each Float32Array back as soon as it's ready (transferred, not copied).
import { RECIPES, Synth, renderMusic } from "./synth";

const PRIORITY = ["ui_click", "ui_hover", "ui_select", "cast_charge", "fire_cast", "fire_boom", "hit", "fizzle", "slime_die", "spawn", "xp"];

self.onmessage = (e: MessageEvent<{ sampleRate: number }>) => {
  const s = new Synth(e.data.sampleRate);
  const names = [...PRIORITY.filter((n) => n in RECIPES), ...Object.keys(RECIPES).filter((n) => !PRIORITY.includes(n))];
  for (const name of names) {
    const data = RECIPES[name](s);
    (self as unknown as Worker).postMessage({ name, data }, [data.buffer]);
  }
  const music = renderMusic(s);
  (self as unknown as Worker).postMessage({ name: "__music", data: music }, [music.buffer]);
  (self as unknown as Worker).postMessage({ done: true });
};
