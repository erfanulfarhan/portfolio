/**
 * The soundtrack. The site plays the recording at SOUNDTRACK_URL through Web
 * Audio, so it fades in and out smoothly everywhere. With no recording set, it
 * falls back to a piece generated live: slow open-fifth piano arpeggios in A
 * minor over a held organ chord, a sparse melody and a quiet clock tick, all in
 * a long reverb.
 */
export const SOUNDTRACK_URL = '/audio/soundtrack.m4a';

const BPM = 63;
const EIGHTH = 60 / BPM / 2;
const LOOKAHEAD = 0.3; // seconds of music scheduled ahead of the clock
const VOLUME = 0.5;
const FILE_VOLUME = 0.9; // the recording is mastered (peaks at -2.6 dB), so it barely needs trimming

type Chord = { root: number; third: number };
// MIDI note numbers. Each chord is played root, fifth, ninth, fifth, tenth, fifth, ninth, fifth.
const AM: Chord = { root: 45, third: 15 };
const F: Chord = { root: 41, third: 16 };
const C: Chord = { root: 48, third: 16 };
const G: Chord = { root: 43, third: 16 };
const DM: Chord = { root: 50, third: 15 };
const E: Chord = { root: 40, third: 16 };

/** [eighth in the bar, note, length in eighths] */
type Note = [at: number, midi: number, length: number];

const MELODY_ONE: Note[][] = [
  [[0, 76, 4], [4, 74, 2], [6, 72, 2]],
  [[0, 72, 6], [6, 69, 2]],
  [[0, 67, 4], [4, 76, 4]],
  [[0, 74, 8]],
];
const MELODY_TWO: Note[][] = [
  [[0, 76, 4], [4, 81, 4]],
  [[0, 79, 4], [4, 77, 2], [6, 76, 2]],
  [[0, 74, 4], [4, 77, 4]],
  [[0, 76, 2], [2, 74, 2], [4, 71, 2], [6, 68, 2]],
];

type Section = {
  chords: Chord[];
  arp: 'even' | 'rising' | 'sparse';
  pad: boolean;
  melody?: Note[][];
  tick?: boolean;
  level: number;
};

// Played in order; after the last, it goes back to the second (the bare opening plays once).
const SECTIONS: Section[] = [
  { chords: [AM, F, C, G], arp: 'even', pad: false, level: 0.8 },
  { chords: [AM, F, C, G], arp: 'even', pad: true, level: 0.9 },
  { chords: [AM, F, C, G], arp: 'even', pad: true, melody: MELODY_ONE, tick: true, level: 1 },
  { chords: [AM, F, DM, E], arp: 'rising', pad: true, melody: MELODY_TWO, tick: true, level: 1.05 },
  { chords: [AM, F, C, G], arp: 'sparse', pad: true, level: 0.85 },
];

const ARP = {
  even: (c: Chord) => [0, 7, 14, 7, c.third + 12, 7, 14, 7].map((i) => c.root + i),
  rising: (c: Chord) => [0, 7, 12, 14, c.third + 12, 14, 12, 7].map((i) => c.root + i),
  sparse: (c: Chord) => [0, -1, 14, -1, c.third + 12, -1, -1, -1].map((i) => (i < 0 ? -1 : c.root + i)),
};

const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

// A visitor's "off" is kept between visits under this name. It was 'sound'
// before the music became on by default, and an "off" saved then (from the old
// switch or the short-lived "Without sound" button) no longer counts.
const WANT_KEY = 'music';
const RETIRED_KEYS = ['sound'];

/** The music is on unless this visitor has turned it off before. */
function readWanted() {
  try {
    RETIRED_KEYS.forEach((key) => localStorage.removeItem(key));
    return localStorage.getItem(WANT_KEY) !== 'off';
  } catch {
    return true;
  }
}

function saveWanted(on: boolean) {
  try {
    if (on) localStorage.removeItem(WANT_KEY);
    else localStorage.setItem(WANT_KEY, 'off');
  } catch {
    // Storage can be blocked; the choice then lasts for this visit only.
  }
}

// The inputs every browser accepts as the visitor's go-ahead for sound.
const GO_AHEAD = ['pointerdown', 'pointerup', 'keydown', 'touchend'] as const;

const savingData = () => Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

/**
 * Whether the browser lets this page play sound before any click. Asked with a
 * tenth of a second of silence made on the spot, so the answer is immediate on
 * any connection instead of waiting for the soundtrack itself to load.
 */
async function soundAllowedNow() {
  const policy = (navigator as Navigator & { getAutoplayPolicy?: (type: string) => string }).getAutoplayPolicy?.(
    'mediaelement',
  );
  if (policy) return policy === 'allowed';
  const samples = 800; // 8-bit mono at 8 kHz, every sample at the silent midpoint
  const wav = new DataView(new ArrayBuffer(44 + samples));
  const text = (at: number, s: string) => [...s].forEach((c, i) => wav.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  wav.setUint32(4, 36 + samples, true);
  text(8, 'WAVEfmt ');
  wav.setUint32(16, 16, true);
  wav.setUint16(20, 1, true);
  wav.setUint16(22, 1, true);
  wav.setUint32(24, 8000, true);
  wav.setUint32(28, 8000, true);
  wav.setUint16(32, 1, true);
  wav.setUint16(34, 8, true);
  text(36, 'data');
  wav.setUint32(40, samples, true);
  for (let i = 0; i < samples; i += 1) wav.setUint8(44 + i, 128);
  const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
  const probe = new Audio(url);
  try {
    await probe.play();
    probe.pause();
    return true;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// iPhones play Web Audio as ambient sound, which the ring switch silences, and
// most phones live on silent. Asking for a playback session (Safari 16.4 and
// later) makes the music play the way a music app's does.
const audioSession = () => (navigator as Navigator & { audioSession?: { type: string } }).audioSession;

// iOS ignores an audio element's own volume, which is why the file normally
// plays through Web Audio's fader. An iPhone too old for audio sessions would
// keep that silent on mute, so there the element plays by itself, unfaded.
let playsDirect: boolean | undefined;
const directPlayback = () => {
  if (playsDirect === undefined) {
    const probe = document.createElement('audio');
    probe.volume = 0.5;
    playsDirect = !audioSession() && probe.volume !== 0.5;
  }
  return playsDirect;
};

class Soundtrack {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: GainNode | null = null;
  private pianoWave: PeriodicWave | null = null;
  private organWave: PeriodicWave | null = null;
  private noise: AudioBuffer | null = null;
  private timer = 0;
  private sleep = 0;
  private step = 0;
  private nextTime = 0;
  private section = 0;
  private playing = false;
  private wanted = readWanted();
  private waiting = false;
  private audio: HTMLAudioElement | null = null;
  private routed = false;
  private readonly listeners = new Set<() => void>();

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (!this.playing) return;
      if (document.hidden) {
        void this.ctx?.suspend();
        this.audio?.pause();
      } else {
        void this.ctx?.resume();
        void this.audio?.play().catch(() => {});
      }
    });
  }

  get isPlaying() {
    return this.playing;
  }

  /** On unless the visitor turned it off, even while waiting for their first click. */
  get isWanted() {
    return this.wanted;
  }

  /** Tells `listener` whenever the music starts or stops, or the visitor changes their mind. */
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  private setPlaying(on: boolean) {
    if (this.playing === on) return;
    this.playing = on;
    this.emit();
  }

  /**
   * On by default. Where the browser allows sound on arrival, `tryAutoplay`
   * starts the music as the page opens; everywhere else it starts with the
   * visitor's first click, tap or key press. A visitor who turned it off stays
   * off, and one whose browser is saving data is not started for them.
   */
  arm() {
    if (!this.wanted || this.playing || savingData()) return;
    this.listen();
  }

  /**
   * Starts the music without waiting for a click, if this browser allows it
   * (some do once the visitor allows sound for the site). The answer tells the
   * intro whether to ask the visitor in: 'blocked' means the music needs a
   * click, tap or key press first.
   */
  async tryAutoplay(): Promise<'playing' | 'blocked' | 'off'> {
    if (!this.wanted || savingData()) return 'off';
    if (this.playing) return 'playing';
    if (!SOUNDTRACK_URL) return 'blocked'; // the generated piece always waits for a click
    if (!(await soundAllowedNow())) return 'blocked';
    if (this.playing) return 'playing'; // a click got there first
    if (!this.wanted) return 'off';
    this.unlisten();
    this.start();
    // A browser may allow the page's audio yet hold Web Audio back until a click.
    const ctx = this.ctx;
    // Read afresh each time: the state changes while we wait.
    const running = () => ctx?.state === 'running';
    if (ctx && !running()) {
      await Promise.race([ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 600))]);
      if (!running() && this.playing) {
        this.stop();
        if (this.wanted) this.listen();
        return 'blocked';
      }
    }
    return 'playing';
  }

  /**
   * The intro's "click anywhere to enter". Called inside that click, tap or key
   * press, which is what every browser needs before it lets the music play.
   */
  begin() {
    this.unlisten();
    if (this.wanted && !this.playing && !savingData()) this.start();
  }

  /** The Sound switch: silences the music if it is playing, otherwise starts it now. */
  toggle() {
    this.unlisten();
    this.wanted = !this.playing;
    saveWanted(this.wanted);
    if (this.wanted) this.start();
    else this.stop();
    this.emit();
  }

  private listen() {
    if (this.waiting) return;
    this.waiting = true;
    GO_AHEAD.forEach((type) => window.addEventListener(type, this.goAhead, { capture: true, passive: true }));
  }

  private unlisten() {
    if (!this.waiting) return;
    this.waiting = false;
    GO_AHEAD.forEach((type) => window.removeEventListener(type, this.goAhead, { capture: true }));
  }

  private goAhead = (e: Event) => {
    // The Sound switch decides for itself.
    if (e.target instanceof Element && e.target.closest('[data-sound-control]')) return;
    if (e instanceof KeyboardEvent && e.key === 'Escape') return;
    this.unlisten();
    if (this.wanted && !this.playing) this.start();
  };

  private start() {
    if (this.playing) return;
    const session = audioSession();
    if (session) session.type = 'playback';
    let ctx: AudioContext;
    try {
      ctx = this.ensureContext();
    } catch {
      return; // no Web Audio here; the switch simply stays off
    }
    this.setPlaying(true);
    window.clearTimeout(this.sleep);
    void ctx.resume();
    const now = ctx.currentTime;
    const master = this.master!;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(SOUNDTRACK_URL ? FILE_VOLUME : VOLUME, now + 2.5);
    if (SOUNDTRACK_URL) return this.playFile();

    // Start at the top of a phrase, just after now.
    this.step = 0;
    this.section = 0;
    this.nextTime = now + 0.12;
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.schedule(), 80);
    this.schedule();
  }

  private stop() {
    if (!this.playing || !this.ctx) return;
    this.setPlaying(false);
    const ctx = this.ctx;
    const master = this.master!;
    const now = ctx.currentTime;
    window.clearInterval(this.timer);
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + 1.2);
    // A file playing outside Web Audio has no fade to wait for.
    if (SOUNDTRACK_URL && directPlayback()) this.audio?.pause();
    // Notes already scheduled keep sounding into the fade, then the context sleeps.
    window.clearTimeout(this.sleep);
    this.sleep = window.setTimeout(() => {
      if (this.playing) return;
      this.audio?.pause();
      void ctx.suspend();
    }, 1500);
  }

  /* ---------- the recording ---------- */

  private element() {
    if (!this.audio) {
      this.audio = new Audio(SOUNDTRACK_URL);
      this.audio.loop = true;
    }
    return this.audio;
  }

  // The file plays through the same master fader as the generated piece, so it
  // fades in and out everywhere (iOS ignores an audio element's own volume),
  // except on an iPhone too old to ask for a playback session (see above).
  private playFile() {
    const audio = this.element();
    if (!this.routed && !directPlayback()) {
      this.ctx!.createMediaElementSource(audio).connect(this.master!);
      this.routed = true;
    }
    audio.volume = 1;
    // Refused (the input was not a go-ahead in this browser): wait for the next one.
    audio.play().catch(() => {
      this.stop();
      if (this.wanted) this.listen();
    });
  }

  /* ---------- the generated piece ---------- */

  private ensureContext() {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext({ latencyHint: 'playback' });
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0;
    this.master = master;
    // A finished recording needs no help: straight out, through the fader only.
    if (SOUNDTRACK_URL) {
      master.connect(ctx.destination);
      return ctx;
    }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 3;
    comp.attack.value = 0.02;
    comp.release.value = 0.4;
    // Nothing useful lives below 45 Hz; laptop speakers only turn it into mud.
    const floor = ctx.createBiquadFilter();
    floor.type = 'highpass';
    floor.frequency.value = 45;
    master.connect(floor).connect(comp).connect(ctx.destination);

    // Everything plays into one bus: part of it dry, part into a long hall.
    const bus = ctx.createGain();
    const dry = ctx.createGain();
    dry.gain.value = 0.72;
    const wet = ctx.createGain();
    wet.gain.value = 0.42;
    const hall = ctx.createConvolver();
    hall.buffer = this.impulse(ctx, 4.2);
    // The hall gets no bass, so the low notes stay clear instead of washing together.
    const send = ctx.createBiquadFilter();
    send.type = 'highpass';
    send.frequency.value = 220;
    bus.connect(dry).connect(master);
    bus.connect(send).connect(hall).connect(wet).connect(master);
    this.bus = bus;

    // A piano-like spectrum: strong fundamental, partials falling away.
    const pianoAmps = [0, 1, 0.5, 0.3, 0.2, 0.13, 0.09, 0.06, 0.045, 0.03, 0.02];
    this.pianoWave = ctx.createPeriodicWave(new Float32Array(pianoAmps), new Float32Array(pianoAmps.length));
    // A pipe organ: the octave stops (harmonics 1, 2, 4, 8) and a little of the twelfth.
    const organ = new Float32Array(9);
    organ[1] = 1;
    organ[2] = 0.55;
    organ[3] = 0.12;
    organ[4] = 0.3;
    organ[8] = 0.1;
    this.organWave = ctx.createPeriodicWave(organ, new Float32Array(9));

    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    this.noise = noise;
    return ctx;
  }

  /** A synthetic hall: stereo noise that dies away and darkens as it does. */
  private impulse(ctx: AudioContext, seconds: number) {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const buffer = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch += 1) {
      const data = buffer.getChannelData(ch);
      let low = 0;
      for (let i = 0; i < length; i += 1) {
        const t = i / rate;
        const env = t < 0.025 ? 0 : Math.exp(-(t - 0.025) * 1.7);
        // A one-pole low-pass that closes over time.
        const k = 0.8 - 0.55 * Math.min(1, t / seconds);
        low += (Math.random() * 2 - 1 - low) * k;
        data[i] = low * env;
      }
    }
    return buffer;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    // After a stall (a long task, a sleeping tab) skip the notes whose time has
    // passed rather than playing them all at once.
    while (this.nextTime < ctx.currentTime - 0.05) this.advance();
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      this.playStep(this.step, this.nextTime);
      this.advance();
    }
  }

  private advance() {
    this.step += 1;
    this.nextTime += EIGHTH;
    // A section is four bars of eight eighths.
    if (this.step % 32 === 0) this.section = this.section + 1 < SECTIONS.length ? this.section + 1 : 1;
  }

  private playStep(step: number, time: number) {
    const s = SECTIONS[this.section];
    const bar = Math.floor((step % 32) / 8);
    const eighth = step % 8;
    const chord = s.chords[bar];
    // Held to the end of the bar, like a sustain pedal changed at each bar line.
    const toBarEnd = (8 - eighth) * EIGHTH;
    const sway = (Math.random() - 0.5) * 0.012;

    const note = ARP[s.arp](chord)[eighth];
    if (note > 0) {
      const accent = eighth === 0 ? 1.25 : eighth === 4 ? 1.1 : 1;
      this.piano(note, time + sway, toBarEnd + 0.35, (0.34 + Math.random() * 0.06) * accent * s.level);
    }

    if (eighth === 0 && s.pad) this.organ(chord, time, 8 * EIGHTH);
    if (s.tick && eighth % 2 === 0) this.tick(time);

    for (const [at, midi, length] of s.melody?.[bar] ?? []) {
      if (at === eighth) this.piano(midi, time + sway * 0.5, length * EIGHTH + 0.6, (0.5 + Math.random() * 0.06) * s.level);
    }
  }

  private piano(midi: number, time: number, duration: number, velocity: number) {
    const ctx = this.ctx!;
    const f0 = freq(midi);
    const out = ctx.createGain();
    out.connect(this.bus!);

    // Brightness fades after the strike, as a real string's high partials do.
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.Q.value = 0.3;
    tone.frequency.setValueAtTime(Math.min(14000, f0 * (5 + velocity * 12)), time);
    tone.frequency.exponentialRampToValueAtTime(Math.max(260, f0 * 1.6), time + 1.8);
    tone.connect(out);

    // Two strings a hair apart in pitch, which gives a piano note its slow shimmer.
    const level = 0.42 * velocity;
    const ring = 2.4 * Math.pow(220 / f0, 0.35);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(level, time + 0.006);
    env.gain.setTargetAtTime(level * 0.4, time + 0.006, 0.12);
    env.gain.setTargetAtTime(0, time + 0.3, ring);
    env.gain.setTargetAtTime(0, time + duration, 0.18);
    env.connect(tone);
    for (const detune of [-1.6, 1.6]) {
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(this.pianoWave!);
      osc.frequency.value = f0;
      osc.detune.value = detune;
      osc.connect(env);
      osc.start(time);
      osc.stop(time + duration + 1.2);
      if (detune > 0) osc.onended = () => out.disconnect();
    }

    // The hammer: a very short knock of filtered noise.
    const knock = ctx.createBufferSource();
    knock.buffer = this.noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = Math.min(6000, f0 * 6);
    band.Q.value = 0.8;
    const knockGain = ctx.createGain();
    knockGain.gain.setValueAtTime(level * 0.35, time);
    knockGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
    knock.connect(band).connect(knockGain).connect(out);
    knock.start(time, Math.random() * 0.9, 0.05);
  }

  private organ(chord: Chord, time: number, length: number) {
    const ctx = this.ctx!;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 1300;
    tone.connect(this.bus!);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(0.07, time + 1.6);
    env.gain.setValueAtTime(0.07, time + length);
    env.gain.linearRampToValueAtTime(0, time + length + 2.2);
    env.connect(tone);
    for (const offset of [0, 7, 12]) {
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(this.organWave!);
      osc.frequency.value = freq(chord.root + offset);
      osc.detune.value = (Math.random() - 0.5) * 4;
      osc.connect(env);
      osc.start(time);
      osc.stop(time + length + 2.4);
      if (offset === 12) osc.onended = () => tone.disconnect();
    }
  }

  /** A soft clock tick on each beat. */
  private tick(time: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 3200;
    band.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.025);
    src.connect(band).connect(g).connect(this.bus!);
    src.start(time, Math.random() * 0.9, 0.04);
    src.onended = () => g.disconnect();
  }
}

export const soundtrack = new Soundtrack();
