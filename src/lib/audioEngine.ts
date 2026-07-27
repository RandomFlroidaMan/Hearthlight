/**
 * Pure Web Audio graph management, no React — a thin hook in
 * useAudioEngine.ts wires this into component lifecycle. One AudioContext
 * with three independent gain buses (narration / ambience / effects) so
 * muting is an instant gain change, never a stop/restart click. Ambience
 * crossfades between tracks via a per-source gain node feeding the shared
 * ambience bus, and ducks under narration.
 */

export type MuteState = {
  narrationMuted: boolean;
  ambienceMuted: boolean;
  effectsMuted: boolean;
};

const AMBIENCE_GAIN = 0.4;
const AMBIENCE_DUCKED_GAIN = 0.15;
const EFFECTS_GAIN = 0.8;
const CROSSFADE_SECONDS = 1.5;
const DUCK_RAMP_SECONDS = 0.4;
const MUTE_RAMP_TIME_CONSTANT = 0.05;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private narrationBus: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private bufferCache = new Map<string, AudioBuffer>();
  private currentAmbience: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private currentAmbienceKey: string | null = null;
  private currentNarrationSource: AudioBufferSourceNode | null = null;
  private speakingFallback = false;
  private mute: MuteState;

  constructor(initialMute: MuteState) {
    this.mute = initialMute;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const ctx = new AudioContext();
      const narrationBus = ctx.createGain();
      const ambienceBus = ctx.createGain();
      const effectsBus = ctx.createGain();
      narrationBus.connect(ctx.destination);
      ambienceBus.connect(ctx.destination);
      effectsBus.connect(ctx.destination);
      narrationBus.gain.value = this.mute.narrationMuted ? 0 : 1;
      ambienceBus.gain.value = this.mute.ambienceMuted ? 0 : AMBIENCE_GAIN;
      effectsBus.gain.value = this.mute.effectsMuted ? 0 : EFFECTS_GAIN;
      this.ctx = ctx;
      this.narrationBus = narrationBus;
      this.ambienceBus = ambienceBus;
      this.effectsBus = effectsBus;
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    const cached = this.bufferCache.get(url);
    if (cached) return cached;
    try {
      const ctx = this.ensureContext();
      const res = await fetch(url);
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      this.bufferCache.set(url, buffer);
      return buffer;
    } catch {
      return null;
    }
  }

  setMute(mute: MuteState): void {
    this.mute = mute;
    if (mute.narrationMuted) this.stopSpeechFallback();
    if (!this.ctx || !this.narrationBus || !this.ambienceBus || !this.effectsBus) return;
    const now = this.ctx.currentTime;
    this.narrationBus.gain.setTargetAtTime(mute.narrationMuted ? 0 : 1, now, MUTE_RAMP_TIME_CONSTANT);
    const ambienceTarget = mute.ambienceMuted
      ? 0
      : this.currentNarrationSource || this.speakingFallback
        ? AMBIENCE_DUCKED_GAIN
        : AMBIENCE_GAIN;
    this.ambienceBus.gain.setTargetAtTime(ambienceTarget, now, MUTE_RAMP_TIME_CONSTANT);
    this.effectsBus.gain.setTargetAtTime(mute.effectsMuted ? 0 : EFFECTS_GAIN, now, MUTE_RAMP_TIME_CONSTANT);
  }

  private duckAmbience(ducked: boolean): void {
    if (!this.ctx || !this.ambienceBus || this.mute.ambienceMuted) return;
    const target = ducked ? AMBIENCE_DUCKED_GAIN : AMBIENCE_GAIN;
    this.ambienceBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.ambienceBus.gain.linearRampToValueAtTime(target, this.ctx.currentTime + DUCK_RAMP_SECONDS);
  }

  /** Plays generated narration audio at `url`, or — when generation failed
   * or was skipped (a spend cap, a transient TTS error) — falls back to the
   * browser's own speechSynthesis reading `fallbackText` aloud, so a scene
   * is never silently voiceless. `url` wins whenever it's present. */
  async playNarration(url: string | null, fallbackText?: string): Promise<void> {
    try {
      this.currentNarrationSource?.stop();
    } catch {
      // Already stopped/ended — fine.
    }
    this.currentNarrationSource = null;
    this.stopSpeechFallback();
    this.duckAmbience(false);
    if (!url) {
      if (fallbackText) this.speakFallback(fallbackText);
      return;
    }

    const ctx = this.ensureContext();
    const buffer = await this.loadBuffer(url);
    // dispose() may have torn down this context (and rebuilt a new one)
    // while the fetch/decode above was in flight — e.g. React StrictMode's
    // dev-mode double-invoke unmounts and remounts the owning effect before
    // a real network round trip resolves. Nodes can't cross contexts, so
    // bail rather than connect a source from a closed context.
    if (ctx !== this.ctx) return;
    if (!buffer || !this.narrationBus) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.narrationBus);
    source.onended = () => {
      if (this.currentNarrationSource === source) {
        this.currentNarrationSource = null;
        this.duckAmbience(false);
      }
    };
    this.currentNarrationSource = source;
    this.duckAmbience(true);
    source.start();
  }

  async setAmbience(key: string | null, url: string | null): Promise<void> {
    if (key === this.currentAmbienceKey) return;
    this.currentAmbienceKey = key;

    const ctx = this.ensureContext();
    const old = this.currentAmbience;
    this.currentAmbience = null;

    if (old) {
      old.gain.gain.cancelScheduledValues(ctx.currentTime);
      old.gain.gain.setValueAtTime(old.gain.gain.value, ctx.currentTime);
      old.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + CROSSFADE_SECONDS);
      const staleSource = old.source;
      setTimeout(() => {
        try {
          staleSource.stop();
        } catch {
          // Already stopped — fine.
        }
      }, CROSSFADE_SECONDS * 1000 + 50);
    }

    if (!url || !this.ambienceBus) return;

    const buffer = await this.loadBuffer(url);
    // The ambience track may have changed again while this was loading, or
    // (same StrictMode/remount race as playNarration) the context itself
    // may have been torn down and rebuilt.
    if (this.currentAmbienceKey !== key) return;
    if (ctx !== this.ctx || !this.ambienceBus) return;
    if (!buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const perSourceGain = ctx.createGain();
    perSourceGain.gain.value = 0;
    source.connect(perSourceGain);
    perSourceGain.connect(this.ambienceBus);
    perSourceGain.gain.linearRampToValueAtTime(1, ctx.currentTime + CROSSFADE_SECONDS);
    source.start();
    this.currentAmbience = { source, gain: perSourceGain };
  }

  async playSfx(url: string | null): Promise<void> {
    if (!url) return;
    const ctx = this.ensureContext();
    const buffer = await this.loadBuffer(url);
    if (ctx !== this.ctx) return;
    if (!buffer || !this.effectsBus) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.effectsBus);
    source.start();
  }

  private speakFallback(text: string): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (this.mute.narrationMuted) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => {
      this.speakingFallback = true;
      this.duckAmbience(true);
    };
    utterance.onend = utterance.onerror = () => {
      this.speakingFallback = false;
      this.duckAmbience(false);
    };
    window.speechSynthesis.speak(utterance);
  }

  private stopSpeechFallback(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    this.speakingFallback = false;
  }

  dispose(): void {
    try {
      this.currentNarrationSource?.stop();
    } catch {
      // Fine.
    }
    try {
      this.currentAmbience?.source.stop();
    } catch {
      // Fine.
    }
    this.stopSpeechFallback();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.narrationBus = null;
    this.ambienceBus = null;
    this.effectsBus = null;
    this.currentAmbience = null;
    this.currentAmbienceKey = null;
    this.currentNarrationSource = null;
  }
}
