export class Timeline {
  constructor(data){
    this.d = data;
    this.bpm = data.bpm; this.beat = data.beat; this.barSec = data.barSec;
    this.origin = data.gridOrigin; this.duration = data.duration;
    this._bars = data.bars;
  }
  static async load(url='/data/timeline.json'){
    // the packed single-file preview inlines the data, so no fetch is possible
    if (typeof window !== 'undefined' && window.__TIMELINE__) return new Timeline(window.__TIMELINE__);
    const r = await fetch(url); return new Timeline(await r.json());
  }
  timeOfBar(b){ return this.origin + (b-1)*this.barSec; }
  bar(t){ return (t - this.origin)/this.barSec + 1; }
  barIndex(t){ return Math.floor(this.bar(t)); }
  /** 0..1 position inside current bar */
  barPhase(t){ const b=this.bar(t); return b-Math.floor(b); }
  /** 0..1 position inside current beat */
  beatPhase(t){ const x=(t-this.origin)/this.beat; return x-Math.floor(x); }
  beatIndex(t){ return Math.floor((t-this.origin)/this.beat); }
  /** decaying pulse fired on every beat; k = decay sharpness */
  beatPulse(t,k=9){ return Math.exp(-this.beatPhase(t)*k); }
  /** decaying pulse on every Nth beat starting from bar downbeats */
  barPulse(t,k=3){ return Math.exp(-this.barPhase(t)*k); }
  sectionAt(t){ return this.d.sections.find(s=>t>=s.t&&t<s.tEnd) || null; }
  sceneAt(t){ return this.d.scenes.find(s=>t>=s.t&&t<s.tEnd) || null; }
  scene(id){ return this.d.scenes.find(s=>s.id===id); }
  /** A hit: a cue's own decaying flash, and it CANNOT START BEFORE THE CUE.
   *
   *  Written here because it was written wrong in four scenes at once, in the
   *  same shape each time: exp(-|t - cue|*k). That is symmetric, so the frame
   *  begins washing out half a second BEFORE the shout it is a reaction to —
   *  the eye has finished adapting by the time the sound lands, and what was
   *  meant as an impact reads as a long milky swell with a cue somewhere in
   *  the middle of it. Measured on S10's third shout, the fifth percentile of
   *  the frame went from 29 to 146 over a full second of ramp.
   *
   *  Causal, therefore: nothing before the cue, a two-frame attack so the
   *  onset is a step rather than a click, and the decay it always had.
   */
  hit(t, cue, k = 7, attack = 2/60){
    const dt = t - cue;
    if (dt < 0) return 0;
    const rise = attack > 0 ? Math.min(1, dt/attack) : 1;
    return rise*Math.exp(-Math.max(0, dt - attack)*k);
  }

  /** measured per-bar energy, linearly interpolated */
  energy(t,key='kick'){
    const b=this.bar(t), i=Math.floor(b)-1;
    const a=this._bars[Math.max(0,Math.min(this._bars.length-1,i))];
    const c=this._bars[Math.max(0,Math.min(this._bars.length-1,i+1))];
    const f=b-Math.floor(b);
    return a[key]*(1-f)+c[key]*f;
  }
}
