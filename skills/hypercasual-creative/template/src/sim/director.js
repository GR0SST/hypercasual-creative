// Director layer: the video is scripted, not simulated. Rules (movement,
// pickups, growth) run for real only where that is cheaper than faking;
// everything that must land on a beat is a cue. Cues fire once at video time
// and may override any rule (teleport, slow-mo, force an event, hide a cut).
export class Director {
  constructor() {
    this.cues = [];
    this.spans = [];
    this.next = 0;
  }

  // One-shot: fn(world) at video time t.
  at(t, fn, label = '') {
    this.cues.push({ t, fn, label });
    this.cues.sort((a, b) => a.t - b.t);
    return this;
  }

  // Continuous: fn(world, u) every step while a <= t < b, u = 0..1.
  during(a, b, fn) {
    this.spans.push({ a, b, fn });
    return this;
  }

  update(world, clock) {
    while (this.next < this.cues.length && this.cues[this.next].t <= clock) {
      const c = this.cues[this.next++];
      c.fn(world);
      if (c.label) world.emit('cue', { label: c.label });
    }
    for (const s of this.spans) {
      if (clock >= s.a && clock < s.b) s.fn(world, (clock - s.a) / (s.b - s.a));
    }
  }
}
