import { useEffect, useRef } from "react";
import {
  CALL_STATUS_AUDIO_ASSETS,
  CALL_STATUS_AUDIO_VOLUME,
  getLoopTypeForStatus,
  getOneShotEventForTransition,
} from "../callStatusAudioConfig";

const stopAudioInstance = (audio) => {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
};

const useCallStatusAudio = ({
  callId,
  isActive,
  status,
  isInitiator,
  isRejoinCall,
}) => {
  const loopAudioRef = useRef(null);
  const activeLoopTypeRef = useRef(null);
  const prevStatusRef = useRef(undefined);
  const oneShotAudioCacheRef = useRef(new Map());
  const playedEventKeysRef = useRef(new Set());
  const loggedPlaybackErrorsRef = useRef(new Set());

  const logPlaybackErrorOnce = ({ key, context, error }) => {
    if (loggedPlaybackErrorsRef.current.has(key)) {
      return;
    }
    loggedPlaybackErrorsRef.current.add(key);
    console.warn(`[useCallStatusAudio] ${context}`, error);
  };

  const stopLoopAudio = () => {
    stopAudioInstance(loopAudioRef.current);
    loopAudioRef.current = null;
    activeLoopTypeRef.current = null;
  };

  const playLoopAudio = (loopType, activeCallId) => {
    const src = CALL_STATUS_AUDIO_ASSETS[loopType];
    if (!src) return;

    stopLoopAudio();

    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = CALL_STATUS_AUDIO_VOLUME[loopType] ?? 0.8;
    loopAudioRef.current = audio;
    activeLoopTypeRef.current = loopType;

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((error) => {
        logPlaybackErrorOnce({
          key: `${activeCallId || "no-call"}:loop:${loopType}`,
          context: `loop "${loopType}" playback blocked/failed`,
          error,
        });
      });
    }
  };

  const playOneShotEvent = (eventKey, activeCallId) => {
    const dedupeKey = `${activeCallId}:${eventKey}`;
    if (playedEventKeysRef.current.has(dedupeKey)) {
      return;
    }
    playedEventKeysRef.current.add(dedupeKey);

    const src = CALL_STATUS_AUDIO_ASSETS[eventKey];
    if (!src) return;

    let audio;
    // Cache only call-ended audio because that's the only one-shot we observed
    // as latency-sensitive in real call flow.
    if (eventKey === "callEnded") {
      audio = oneShotAudioCacheRef.current.get(eventKey);
      if (!audio) {
        audio = new Audio(src);
        audio.preload = "auto";
        oneShotAudioCacheRef.current.set(eventKey, audio);
      }
    } else {
      audio = new Audio(src);
    }
    audio.loop = false;
    audio.volume = CALL_STATUS_AUDIO_VOLUME[eventKey] ?? 0.85;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((error) => {
        logPlaybackErrorOnce({
          key: `${activeCallId || "no-call"}:oneshot:${eventKey}`,
          context: `one-shot "${eventKey}" playback blocked/failed`,
          error,
        });
      });
    }
  };

  useEffect(() => {
    if (!isActive || !callId) {
      return;
    }
    const src = CALL_STATUS_AUDIO_ASSETS.callEnded;
    if (!src) {
      return;
    }
    if (!oneShotAudioCacheRef.current.has("callEnded")) {
      const audio = new Audio(src);
      audio.preload = "auto";
      oneShotAudioCacheRef.current.set("callEnded", audio);
      audio.load();
    }
  }, [callId, isActive]);

  useEffect(() => {
    if (!isActive || !callId) {
      stopLoopAudio();
      prevStatusRef.current = status;
      return;
    }

    const currentLoopType = getLoopTypeForStatus({
      status,
      isInitiator,
      isRejoinCall,
    });

    if (!currentLoopType) {
      stopLoopAudio();
    } else if (activeLoopTypeRef.current !== currentLoopType) {
      playLoopAudio(currentLoopType, callId);
    }

    const eventKey = getOneShotEventForTransition({
      prevStatus: prevStatusRef.current,
      status,
    });
    if (eventKey) {
      playOneShotEvent(eventKey, callId);
    }

    prevStatusRef.current = status;
  }, [callId, isActive, isInitiator, isRejoinCall, status]);

  useEffect(() => {
    return () => {
      stopLoopAudio();
      oneShotAudioCacheRef.current.forEach((audio) => {
        stopAudioInstance(audio);
      });
      oneShotAudioCacheRef.current.clear();
    };
  }, []);
};

export default useCallStatusAudio;
