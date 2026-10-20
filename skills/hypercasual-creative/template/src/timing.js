// Single source of truth for the cut. Keep index.html's root data-duration
// equal to DURATION (lint needs it as a literal there).
export const FPS = 30;
export const PACKSHOT_AT = 10.6;
export const DURATION = 14;
// Packshot hand taps, seconds after PACKSHOT_AT (GSAP + SFX both read this).
export const TAPS = [1.5, 2.2];
export const SIM_DT = 1 / 60;
export const VIEW_W = 1080;
export const VIEW_H = 1920;
