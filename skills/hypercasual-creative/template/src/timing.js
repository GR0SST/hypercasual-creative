// Single source of truth for the cut (render, sound, review all read it).
// Default output 60 fps (smooth phone playback; sim also steps at 1/60, one step per frame).
export const FPS = 60;
export const PACKSHOT_AT = 10.6;
export const DURATION = 14;
// Packshot hand taps, seconds after PACKSHOT_AT (GSAP + SFX both read this).
export const TAPS = [1.5, 2.2];
export const SIM_DT = 1 / 60;
export const VIEW_W = 1080;
export const VIEW_H = 1920;
