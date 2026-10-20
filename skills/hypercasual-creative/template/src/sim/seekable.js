// HyperFrames seeks to arbitrary times (Studio scrubbing, parallel render
// workers). Our sim is stateful and stepped at a fixed dt, so seeking is:
// forward = keep stepping, backward = rebuild from scratch and replay.
// Replay is cheap because the sim is plain data (no three.js objects) —
// keep it that way: views read sim state, they never own gameplay state.
export class Seekable {
  constructor(build, dt = 1 / 60) {
    this.build = build;
    this.dt = dt;
    this.reset();
  }

  reset() {
    this.sim = this.build();
    this.time = 0;
  }

  seek(t) {
    if (t < this.time - this.dt * 0.5) this.reset();
    while (this.time + this.dt * 0.5 < t) {
      this.sim.step(this.dt);
      this.time += this.dt;
    }
    return this.sim;
  }
}
