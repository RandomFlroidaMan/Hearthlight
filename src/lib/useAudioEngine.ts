"use client";

import { useEffect, useState } from "react";
import { AudioEngine } from "./audioEngine";

/** Lazily constructs one AudioEngine per component instance and keeps it in
 * sync with mute state. Construction itself has no side effects (the
 * AudioContext is only created lazily on first playback) — uses useState's
 * lazy initializer, which React guarantees runs exactly once, rather than a
 * ref (refs may not be read during render under this project's stricter
 * react-hooks/refs rule). Takes the three mute flags as separate primitives
 * rather than a MuteState object so the sync effect's dependency array can
 * name them directly, with no exhaustive-deps friction over object identity. */
export function useAudioEngine(
  narrationMuted: boolean,
  ambienceMuted: boolean,
  effectsMuted: boolean,
): AudioEngine {
  const [engine] = useState(() => new AudioEngine({ narrationMuted, ambienceMuted, effectsMuted }));

  useEffect(() => {
    engine.setMute({ narrationMuted, ambienceMuted, effectsMuted });
  }, [engine, narrationMuted, ambienceMuted, effectsMuted]);

  useEffect(() => {
    return () => {
      engine.dispose();
    };
  }, [engine]);

  return engine;
}
