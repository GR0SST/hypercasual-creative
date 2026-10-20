import { TAPS } from '../timing.js';

// End card on the HyperFrames root GSAP timeline (seekable for free).
// The game keeps running underneath (slowed by the 'packshot' cue) and gets
// blurred; icon pops, logo slams, CTA breathes, hand taps it twice.
export function buildPackshot(tl, at) {
  tl.fromTo('#gl', { filter: 'blur(0px) saturate(1) brightness(1)' }, { filter: 'blur(16px) saturate(0.8) brightness(0.88)', duration: 0.4, ease: 'power3.out' }, at);
  tl.fromTo('.ps-veil', { opacity: 0 }, { opacity: 1, duration: 0.4 }, at);
  tl.fromTo('.ps-rays', { opacity: 0, rotation: 0 }, { opacity: 0.55, rotation: 14, duration: 3.4, ease: 'none' }, at + 0.2);
  tl.fromTo('.ps-icon', { scale: 0, rotation: -25 }, { scale: 1, rotation: 0, duration: 0.4, ease: 'back.out(3.2)' }, at + 0.12);
  tl.to('.ps-icon', { y: -10, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: 5 }, at + 0.55);
  tl.fromTo('.ps-logo', { scale: 2.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.34, ease: 'back.out(2.2)' }, at + 0.28);
  tl.fromTo('.ps-tag', { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power3.out' }, at + 0.5);
  tl.fromTo('.ps-btn', { scale: 0 }, { scale: 1, duration: 0.36, ease: 'back.out(3.5)' }, at + 0.68);
  tl.to('.ps-btn', { scale: 1.04, duration: 0.45, ease: 'sine.inOut', yoyo: true, repeat: 3 }, at + 1.05);
  tl.fromTo('.ps-hand', { x: 320, y: 380, opacity: 0, rotation: -18 }, { x: 0, y: 0, opacity: 1, duration: 0.38, ease: 'power3.out' }, at + 1.05);
  for (const tap of TAPS) {
    const t = at + tap;
    tl.to('.ps-hand', { y: 26, scale: 0.9, duration: 0.11, ease: 'power2.in', yoyo: true, repeat: 1 }, t - 0.08);
    tl.to('.ps-btn-face', { y: 10, scale: 0.94, duration: 0.11, ease: 'power2.in', yoyo: true, repeat: 1 }, t);
    tl.fromTo('.ps-ripple', { scale: 0.3, opacity: 0.9 }, { scale: 1.2, opacity: 0, duration: 0.5, ease: 'power2.out', immediateRender: false }, t);
  }
}
