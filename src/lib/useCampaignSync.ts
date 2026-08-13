"use client";

import { useEffect, useRef } from "react";

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 15000;

/**
 * Connects to this campaign's WebSocket room and calls `onScene` whenever a
 * scene update arrives — from either screen's own action or the other
 * screen's. Reconnects with backoff on drop, and on every (re)connect
 * refetches current state via GET /api/campaigns/[id] first: a dropped
 * connection (the brief's explicit "if the TV drops, the session must not
 * be lost") must never leave a screen stuck on stale data, and this also
 * covers the small race window between the page's initial server render
 * and the socket actually opening.
 */
export function useCampaignSync<T>(params: {
  campaignId: string;
  roomCode: string;
  onScene: (scene: T) => void;
  /** Fired alongside onScene when the broadcast carries the roll/item
   * outcome for the beat that produced this scene — used to cue sound
   * effects. Absent on the initial-load/reconnect refetch, which only
   * ever has a scene, not a fresh outcome to react to. */
  onOutcome?: (outcome: unknown) => void;
  /** A scene's art/narration arrived after its prose/choices already did
   * (see the text-then-media split in generateBeat.ts) — patch just those
   * two fields into whichever scene is currently shown, if it's the one
   * this update is for. */
  onSceneMedia?: (update: { sceneId: string; imagePath: string | null; narrationPath: string | null }) => void;
  /** A beat this screen (or another connected screen) tried to generate
   * failed outright — as opposed to a scene simply not having arrived
   * yet. */
  onGenerationFailed?: (message: string) => void;
  /** Another family joined this room with their own character(s) — the
   * party roster on the server changed underneath this screen. */
  onPartyChanged?: () => void;
}) {
  const onSceneRef = useRef(params.onScene);
  useEffect(() => {
    onSceneRef.current = params.onScene;
  });
  const onOutcomeRef = useRef(params.onOutcome);
  useEffect(() => {
    onOutcomeRef.current = params.onOutcome;
  });
  const onSceneMediaRef = useRef(params.onSceneMedia);
  useEffect(() => {
    onSceneMediaRef.current = params.onSceneMedia;
  });
  const onGenerationFailedRef = useRef(params.onGenerationFailed);
  useEffect(() => {
    onGenerationFailedRef.current = params.onGenerationFailed;
  });
  const onPartyChangedRef = useRef(params.onPartyChanged);
  useEffect(() => {
    onPartyChangedRef.current = params.onPartyChanged;
  });

  const { campaignId, roomCode } = params;

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    async function refetch() {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}`);
        if (res.ok) {
          const json = await res.json();
          onSceneRef.current(json.scene);
        }
      } catch {
        // Best-effort — the next successful reconnect will retry.
      }
    }

    function connect() {
      if (cancelled) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/ws?room=${roomCode}`);

      socket.onopen = () => {
        reconnectAttempt = 0;
        refetch();
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "scene") {
            onSceneRef.current(data.scene);
            if (data.outcome) onOutcomeRef.current?.(data.outcome);
          } else if (data.type === "scene_media") {
            onSceneMediaRef.current?.(data);
          } else if (data.type === "generation_failed") {
            onGenerationFailedRef.current?.(data.message);
          } else if (data.type === "party_changed") {
            onPartyChangedRef.current?.();
          }
        } catch {
          // Ignore malformed messages rather than crashing the screen.
        }
      };

      socket.onclose = () => {
        if (cancelled) return;
        const delay = Math.min(
          RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt,
          RECONNECT_MAX_DELAY_MS,
        );
        reconnectAttempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        socket?.close();
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [campaignId, roomCode]);
}
