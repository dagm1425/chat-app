/* eslint-disable no-unused-vars */
import PropTypes from "prop-types";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import {
  Avatar,
  Box,
  IconButton,
  Typography,
  useMediaQuery,
} from "@mui/material";
import {
  Mic,
  MicOff,
  CallEnd,
  Call,
  ScreenShare,
  Videocam,
  VideocamOff,
} from "@mui/icons-material";
import { useDispatch, useSelector } from "react-redux";
import { selectCall, setCall, selectChatById } from "./chatsSlice";
import { store } from "../../app/store";
import { useEffect, useState, useRef, memo, useMemo } from "react";
import { selectUser } from "../user/userSlice";
import { notifyUser } from "../../common/toast/ToastProvider";
import { getMediaPermissionMessage } from "../../common/utils";
import { sendOneToOneCallHistoryMsg } from "./callHistory";

const CallDurationBase = ({ startTime, visible, formatCallDuration }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Manage pre-join video preview as a single in-flight request:
  // - starts preview only when needed,
  // - drops stale getUserMedia responses from older runs,
  // - and always stops preview tracks on dependency change/unmount to avoid camera leaks.
  // Pre-join preview lifecycle:
  // - starts preview only for incoming video calls before join,
  // - enforces single in-flight getUserMedia request,
  // - rejects stale async responses by requestId (stop returned stale stream),
  // - and stops preview on dependency change/unmount to avoid camera leaks.
  useEffect(() => {
    if (!visible || !startTime) return;

    const update = () => {
      const elapsedMs = Date.now() - startTime.getTime();
      setElapsedSeconds(Math.max(0, Math.floor(elapsedMs / 1000)));
    };

    update();
    const intervalId = setInterval(update, 1000);
    return () => clearInterval(intervalId);
  }, [visible, startTime]);

  if (!visible) return null;
  if (!startTime) return "00:00";
  return formatCallDuration(elapsedSeconds);
};

const CallDuration = memo(CallDurationBase);
const NO_ANSWER_AUTO_HANGUP_MS = 30000;
const RECONNECT_AUTO_HANGUP_MS = 20000;
const isRemoteParticipantReadyForOngoing = ({
  participantUid,
  remoteStreamPresent,
  videoPreferenceByUid,
  screenShareByUid,
  readyStreamIds,
}) => {
  if (!participantUid) return false;

  const hasVideoPreference = Object.prototype.hasOwnProperty.call(
    videoPreferenceByUid,
    participantUid
  );
  if (!hasVideoPreference) return false;

  const shouldRenderVideo =
    videoPreferenceByUid[participantUid] !== false ||
    !!screenShareByUid[participantUid];

  return shouldRenderVideo
    ? readyStreamIds.has(participantUid)
    : remoteStreamPresent;
};

const ReconnectingBadge = ({ sx = {} }) => (
  <Box
    sx={{
      bgcolor: "rgba(0, 0, 0, 0.3)",
      backdropFilter: "blur(5px)",
      color: "white",
      fontSize: "0.8rem",
      borderRadius: "10px",
      px: 1.5,
      py: 0.5,
      ...sx,
    }}
  >
    Reconnecting...
  </Box>
);

CallDurationBase.propTypes = {
  startTime: PropTypes.instanceOf(Date),
  visible: PropTypes.bool.isRequired,
  formatCallDuration: PropTypes.func.isRequired,
};

ReconnectingBadge.propTypes = {
  sx: PropTypes.object,
};

const CallModal = (props) => {
  const {
    peerConnectionsRef,
    localStreamRef,
    remoteStreamsRef,
    streamsVersion, // Tracks when streams are added/removed - use as dependency
    joinCall,
    cleanupLocalCall,
    startScreenShare,
    stopScreenShare,
  } = props;
  const callState = useSelector(selectCall);
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const callData = callState.callData;
  const chat = useSelector((state) => selectChatById(state, callData?.chatId));
  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false);
  const [remoteStreamsArray, setRemoteStreamsArray] = useState([]); // For group calls: [[userId, stream], ...]
  const [readyRemoteStreamIds, setReadyRemoteStreamIds] = useState(
    () => new Set()
  );
  // Local user's key is typically absent pre-call/rejoin-preview.
  // This map is populated from Firestore after joinCall writes call.callData.videoEnabled.<uid>.
  // Until then, preJoinVideoEnabled is the source of truth for local pre-join video intent.
  const [videoEnabledMap, setVideoEnabledMap] = useState({});
  const [preJoinVideoEnabled, setPreJoinVideoEnabled] = useState(true);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewPermissionDenied, setPreviewPermissionDenied] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isLocalVideoFading, setIsLocalVideoFading] = useState(false);
  const [isLocalVideoIntro, setIsLocalVideoIntro] = useState(false);
  const [screenSharingUids, setScreenSharingUids] = useState({}); // Track who's screen sharing
  // const timeoutRef = useRef(null);
  const modalRef = useRef(null);

  const dragOffset = useRef({ x: 0, y: 0 });
  const startTimeRef = useRef(null);
  const dragging = useRef(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const previewStreamRef = useRef(null);
  const localVideoSwapInFlightRef = useRef(false);
  const manualScreenShareStopRef = useRef(false);
  const localVideoFadeTimeoutRef = useRef(null);
  const noAnswerHangupTimeoutRef = useRef(null);
  const reconnectHangupTimeoutRef = useRef(null);
  const latestHangUpRef = useRef(null);
  const localVideoIntroDoneRef = useRef(false);
  const previewRequestIdRef = useRef(0);
  const previewRequestPendingRef = useRef(false);
  const prevOneToOneShouldRenderRef = useRef(undefined);
  const prevGroupShouldRenderByUidRef = useRef(new Map());
  // For group calls: Map of userId -> video element ref
  const remoteVideoRefsMap = useRef(new Map());
  // const timeoutStatusMsg = useRef(null);
  const isCleaningUpRef = useRef(false);
  const isTogglingVideoRef = useRef(false);
  const pendingFrameReadyRef = useRef(new Set());
  const isMobile = useMediaQuery("(max-width:600px)");
  const isOngoingCall = callState.status === "Ongoing call";
  const isConnectingCall = callState.status === "Connecting...";
  const isLineBusyCall = callState.status === "Line busy";
  const isEveryoneBusyCall = callState.status === "Everyone is busy";
  const isBusyOutcomeStatus = isLineBusyCall || isEveryoneBusyCall;
  const isUserInCall = callData?.participants?.includes(user.uid);
  // Rejoin applies to any participant (including initiator) after refresh/reopen
  // while the call is still active but local media isn't connected yet.
  const isRejoinCall = callState.status === "" && isUserInCall;
  const hasLocalVideoFlag = Object.prototype.hasOwnProperty.call(
    videoEnabledMap,
    user.uid
  );
  const isLocalVideoEnabled = hasLocalVideoFlag
    ? videoEnabledMap[user.uid] !== false
    : preJoinVideoEnabled;
  const isLocalVideoActive = isLocalVideoEnabled || isScreenSharing;
  // Include video-off participants so group tiles render even without onPlaying.
  // Example: callee joins with camera OFF -> no onPlaying, but videoEnabled=false should still show avatar tile.
  const readyRemoteStreamsArray = remoteStreamsArray.filter(([userId]) => {
    const hasVideoFlag = Object.prototype.hasOwnProperty.call(
      videoEnabledMap,
      userId
    );
    const isVideoOff =
      hasVideoFlag &&
      videoEnabledMap[userId] === false &&
      !screenSharingUids[userId];
    return readyRemoteStreamIds.has(userId) || isVideoOff;
  });

  useEffect(() => {
    return () => {
      if (localVideoFadeTimeoutRef.current) {
        clearTimeout(localVideoFadeTimeoutRef.current);
        localVideoFadeTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!callState.isActive) {
      localVideoIntroDoneRef.current = false;
      setIsLocalVideoIntro(false);
      return;
    }
    if (localVideoIntroDoneRef.current || !isLocalVideoActive) {
      return;
    }
    localVideoIntroDoneRef.current = true;
    setIsLocalVideoIntro(true);
  }, [callState.isActive, isLocalVideoActive]);

  // Helper functions for participant access
  const getOtherParticipants = () => {
    if (!callData?.participantDetails) return [];
    return Object.keys(callData.participantDetails).filter(
      (uid) => uid !== user.uid
    );
  };

  const getPrimaryRemoteParticipant = () => {
    const otherParticipants = getOtherParticipants();
    if (otherParticipants.length === 0) return null;

    // For 1:1: Return the other participant
    // For group: Return first other participant
    const primaryUid = otherParticipants[0];
    return getParticipantInfo(primaryUid);
  };

  const isInitiator = () => {
    return callData?.initiator === user.uid;
  };

  const getParticipantInfo = (uid) => {
    if (!uid || !callData?.participantDetails) return null;
    return callData.participantDetails[uid] || null;
  };

  const groupBusyInfoLabel = useMemo(() => {
    if (!callData?.isGroupCall) return "";

    const busyAtStart = Array.isArray(callData.busyAtStart)
      ? callData.busyAtStart
      : [];
    if (!busyAtStart.length) return "";

    const activeParticipants = new Set(callData.participants || []);
    const stillBusyUids = busyAtStart.filter(
      (uid) => uid !== user.uid && !activeParticipants.has(uid)
    );
    if (!stillBusyUids.length) return "";

    const names = stillBusyUids.map((uid) => {
      const participant = callData.participantDetails?.[uid];
      return participant?.displayName?.split(" ")[0] || "Unknown";
    });
    const shownNames = names.slice(0, 2).join(", ");
    const remainingCount = names.length - Math.min(names.length, 2);
    const namesLabel =
      remainingCount > 0 ? `${shownNames} +${remainingCount}` : shownNames;

    return `${names.length} busy: ${namesLabel}`;
  }, [
    callData?.busyAtStart,
    callData?.isGroupCall,
    callData?.participantDetails,
    callData?.participants,
    user.uid,
  ]);

  const oneToOneRemote = useMemo(() => {
    if (callData?.isGroupCall) {
      return {
        remoteUid: null,
        hasRemoteVideoPreference: false,
        shouldRenderRemoteVideo: null,
        remoteStreamPresent: false,
        remoteTileReady: false,
      };
    }

    const remoteUid = callData?.participantDetails
      ? Object.keys(callData.participantDetails).find((uid) => uid !== user.uid)
      : null;

    if (!remoteUid) {
      return {
        remoteUid: null,
        hasRemoteVideoPreference: false,
        shouldRenderRemoteVideo: null,
        remoteStreamPresent: false,
        remoteTileReady: false,
      };
    }

    const hasRemoteVideoPreference = Object.prototype.hasOwnProperty.call(
      videoEnabledMap,
      remoteUid
    );
    const shouldRenderRemoteVideo = hasRemoteVideoPreference
      ? videoEnabledMap[remoteUid] !== false || !!screenSharingUids[remoteUid]
      : null;
    const remoteStreamPresent = remoteStreamsArray.some(
      ([userId]) => userId === remoteUid
    );
    const remoteTileReady = isRemoteParticipantReadyForOngoing({
      participantUid: remoteUid,
      remoteStreamPresent,
      videoPreferenceByUid: videoEnabledMap,
      screenShareByUid: screenSharingUids,
      readyStreamIds: readyRemoteStreamIds,
    });

    return {
      remoteUid,
      hasRemoteVideoPreference,
      shouldRenderRemoteVideo,
      remoteStreamPresent,
      remoteTileReady,
    };
  }, [
    callData?.isGroupCall,
    callData?.participantDetails,
    readyRemoteStreamIds,
    remoteStreamsArray,
    screenSharingUids,
    user.uid,
    videoEnabledMap,
  ]);

  const isOneToOneRemoteVideoStreaming =
    !callData?.isGroupCall &&
    !!oneToOneRemote.remoteUid &&
    oneToOneRemote.shouldRenderRemoteVideo === true &&
    readyRemoteStreamIds.has(oneToOneRemote.remoteUid);
  const isGroupTwoParticipantVideoStreaming = (() => {
    if (!callData?.isGroupCall) return false;
    if (remoteStreamsArray.length !== 1) return false;
    const remoteUid = remoteStreamsArray[0]?.[0];
    if (!remoteUid) return false;
    return isRemoteParticipantReadyForOngoing({
      participantUid: remoteUid,
      remoteStreamPresent: true,
      videoPreferenceByUid: videoEnabledMap,
      screenShareByUid: screenSharingUids,
      readyStreamIds: readyRemoteStreamIds,
    });
  })();
  const isDarkControlBg =
    isOngoingCall &&
    (isOneToOneRemoteVideoStreaming || isGroupTwoParticipantVideoStreaming);
  const controlButtonBg = isDarkControlBg
    ? "rgba(0, 0, 0, 0.3)"
    : "rgba(255, 255, 255, 0.08)";
  const controlButtonColor = "#fff";
  const activeControlButtonBg = "#fff";
  const activeControlButtonColor = "#111";
  const isVideoControlDisabled =
    isConnectingCall || isScreenSharing || (!isOngoingCall && !isPreviewing);
  const isVideoDisabledByPreviewBootstrap =
    !isConnectingCall && !isScreenSharing && !isOngoingCall && !isPreviewing;
  const videoControlOpacity =
    isVideoControlDisabled && !isVideoDisabledByPreviewBootstrap ? 0.4 : 1;
  const videoControlBg = isLocalVideoEnabled
    ? controlButtonBg
    : activeControlButtonBg;
  const videoControlColor = isLocalVideoEnabled
    ? controlButtonColor
    : activeControlButtonColor;
  const isScreenShareControlDisabled = isConnectingCall || !isOngoingCall;
  const screenShareControlBg = isScreenSharing
    ? activeControlButtonBg
    : controlButtonBg;
  const screenShareControlColor = isScreenSharing
    ? activeControlButtonColor
    : controlButtonColor;
  const screenShareControlOpacity = isScreenShareControlDisabled ? 0.4 : 1;
  const isMuteControlDisabled = isConnectingCall;
  const muteControlBg = isMuted ? activeControlButtonBg : controlButtonBg;
  const muteControlColor = isMuted
    ? activeControlButtonColor
    : controlButtonColor;
  const muteControlOpacity = isMuteControlDisabled ? 0.4 : 1;
  const shouldShowVideoToggle =
    !isInitiator() || isOngoingCall || isConnectingCall || isRejoinCall;

  useEffect(() => {
    if (callData?.isGroupCall) return;
    const currentShouldRender = oneToOneRemote.shouldRenderRemoteVideo;
    const previousShouldRender = prevOneToOneShouldRenderRef.current;
    const videoNode = remoteVideoRef.current;

    // In 1:1 OFF -> ON transitions, the hidden remote video can remain paused.
    // Resume playback when a stream is already attached.
    if (
      previousShouldRender === false &&
      currentShouldRender === true &&
      videoNode &&
      videoNode.srcObject &&
      videoNode.paused
    ) {
      const playResult = videoNode.play?.();
      if (playResult && typeof playResult.catch === "function") {
        playResult.catch(() => {});
      }
    }

    prevOneToOneShouldRenderRef.current = currentShouldRender;
  }, [callData?.isGroupCall, oneToOneRemote.shouldRenderRemoteVideo]);

  useEffect(() => {
    if (!callData?.isGroupCall || !callData?.isVideoCall) {
      prevGroupShouldRenderByUidRef.current.clear();
      return;
    }

    const prevByUid = prevGroupShouldRenderByUidRef.current;
    const activeRemoteUids = new Set();

    remoteStreamsArray.forEach(([userId]) => {
      activeRemoteUids.add(userId);

      const hasVideoPreference = Object.prototype.hasOwnProperty.call(
        videoEnabledMap,
        userId
      );
      const shouldRenderVideo = hasVideoPreference
        ? videoEnabledMap[userId] !== false || !!screenSharingUids[userId]
        : false;
      const previousShouldRenderVideo = prevByUid.get(userId);

      if (previousShouldRenderVideo === false && shouldRenderVideo === true) {
        const videoRef = remoteVideoRefsMap.current.get(userId);
        const videoNode = videoRef?.current;
        if (videoNode && videoNode.srcObject && videoNode.paused) {
          const playResult = videoNode.play?.();
          if (playResult && typeof playResult.catch === "function") {
            playResult.catch(() => {});
          }
        }
      }

      prevByUid.set(userId, shouldRenderVideo);
    });

    for (const userId of prevByUid.keys()) {
      if (!activeRemoteUids.has(userId)) {
        prevByUid.delete(userId);
      }
    }
  }, [
    callData?.isGroupCall,
    callData?.isVideoCall,
    remoteStreamsArray,
    screenSharingUids,
    videoEnabledMap,
  ]);

  const stopPreviewStream = () => {
    const stream = previewStreamRef.current;
    if (!stream) {
      return;
    }
    if (stream === localStreamRef.current) {
      previewStreamRef.current = null;
      setIsPreviewing(false);
      return;
    }
    stream.getTracks().forEach((track) => track.stop());
    previewStreamRef.current = null;
    setIsPreviewing(false);
    if (localVideoRef.current?.srcObject === stream) {
      localVideoRef.current.srcObject = null;
    }
  };

  const updateVideoEnabled = async (enabled) => {
    if (!callData?.chatId) return;
    setVideoEnabledMap((prev) => ({ ...prev, [user.uid]: enabled }));
    const currentCallState = store.getState().chats.call;
    dispatch(
      setCall({
        ...currentCallState,
        callData: {
          ...currentCallState.callData,
          videoEnabled: {
            ...(currentCallState.callData?.videoEnabled || {}),
            [user.uid]: enabled,
          },
        },
      })
    );
    try {
      await updateDoc(doc(db, "chats", callData.chatId), {
        [`call.callData.videoEnabled.${user.uid}`]: enabled,
      });
    } catch (error) {
      console.error("[CallModal] Failed to update videoEnabled:", error);
    }
  };

  const markRemoteStreamReady = (userId) => {
    if (!userId) return;
    setReadyRemoteStreamIds((prev) => {
      if (prev.has(userId)) return prev;
      const next = new Set(prev);
      next.add(userId);
      return next;
    });
  };

  // Wait for a truly renderable remote frame before marking the tile "ready".
  // Why: `onPlaying` can fire slightly before the first visible frame is stable,
  // which can cause header/timer/PiP UI to transition early and flash.
  const markRemoteFrameReady = (userId, videoEl) => {
    if (!userId || !videoEl) return;
    if (pendingFrameReadyRef.current.has(userId)) return;
    pendingFrameReadyRef.current.add(userId);

    const checkFrameReady = () => {
      if (!videoEl || !videoEl.srcObject) {
        pendingFrameReadyRef.current.delete(userId);
        return;
      }
      if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
        markRemoteStreamReady(userId);
        pendingFrameReadyRef.current.delete(userId);
        return;
      }
      requestAnimationFrame(checkFrameReady);
    };

    requestAnimationFrame(checkFrameReady);
  };

  // Track which streams we've already attached to video elements
  const attachedStreamsRef = useRef(new Set());

  useEffect(() => {
    stopPreviewStream();
    setReadyRemoteStreamIds(new Set());
    setVideoEnabledMap({});
    setPreJoinVideoEnabled(true);
    setIsPreviewing(false);
    setPreviewPermissionDenied(false);
    previewStreamRef.current = null;
    pendingFrameReadyRef.current = new Set();
    return () => {
      stopPreviewStream();
    };
  }, [callData?.chatId]);

  const requestPreviewStream = () => {
    if (
      previewStreamRef.current ||
      previewRequestPendingRef.current ||
      previewPermissionDenied
    )
      return;

    previewRequestPendingRef.current = true;
    const requestId = ++previewRequestIdRef.current;

    navigator.mediaDevices
      .getUserMedia({ video: isLocalVideoEnabled, audio: true })
      .then((stream) => {
        // If a newer request started, discard this stale stream immediately.
        if (requestId !== previewRequestIdRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        previewStreamRef.current = stream;
        setIsPreviewing(true);
        setPreJoinVideoEnabled(isLocalVideoEnabled);
        setPreviewPermissionDenied(false);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      })
      .catch((error) => {
        console.error("[CallModal] Error starting preview stream:", error);
        if (error?.name === "NotAllowedError") {
          setPreviewPermissionDenied(true);
        }
        notifyUser(
          getMediaPermissionMessage({ error, isAudioCall: false }),
          "info"
        );
      })
      .finally(() => {
        if (requestId === previewRequestIdRef.current) {
          previewRequestPendingRef.current = false;
        }
      });
  };

  useEffect(() => {
    const shouldPreview =
      callData?.isVideoCall &&
      callState.status !== "Call ended" &&
      !isBusyOutcomeStatus &&
      (!isUserInCall || isRejoinCall);
    const shouldWaitForRejoinVideoFlag =
      callData?.isVideoCall && isRejoinCall && !hasLocalVideoFlag;

    if (!shouldPreview) {
      // During the join handoff we intentionally keep preview stream alive.
      // joinCall may reuse that same stream; stopping it here can tear down
      // local video and cause visible flicker before ongoing state settles.
      if (isConnectingCall) {
        return;
      }
      stopPreviewStream();
      return;
    }

    // Rejoin must use persisted local intent from Firestore, not preJoin default.
    // Without this gate, preview can request camera before videoEnabled.<uid> hydrates.
    if (shouldWaitForRejoinVideoFlag) {
      return;
    }

    requestPreviewStream();
  }, [
    callData?.isVideoCall,
    callState.status,
    isUserInCall,
    isRejoinCall,
    hasLocalVideoFlag,
    isLocalVideoEnabled,
    isConnectingCall,
    isBusyOutcomeStatus,
  ]);

  // Update remote streams array when streams change (for group calls)
  // streamsVersion increments when streams are added/removed, triggering this effect
  useEffect(() => {
    if (!remoteStreamsRef.current) return;

    const remoteStreams = remoteStreamsRef.current;
    const streamsArray = Array.from(remoteStreams.entries());

    // Update state for group calls (triggers re-render of grid)
    setRemoteStreamsArray(streamsArray);

    // Clean up refs for participants who left
    const currentUserIds = new Set(streamsArray.map(([userId]) => userId));
    remoteVideoRefsMap.current.forEach((ref, userId) => {
      if (!currentUserIds.has(userId)) {
        remoteVideoRefsMap.current.delete(userId);
        attachedStreamsRef.current.delete(userId);
        pendingFrameReadyRef.current.delete(userId);
      }
    });

    setReadyRemoteStreamIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      next.forEach((userId) => {
        if (!currentUserIds.has(userId)) {
          next.delete(userId);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [streamsVersion, callState, dispatch]); // Only runs when streams actually change

  useEffect(() => {
    if (!callData?.isVideoCall || callData?.isGroupCall) return;
    if (isCleaningUpRef.current) return;
    if (
      callState.status === "Ongoing call" ||
      callState.status === "Call ended"
    )
      return;
    // remoteTileReady is a strict gate and already implies remote uid/stream.
    if (!oneToOneRemote.remoteTileReady) return;

    // 1:1 video: set "Ongoing call" only when the remote tile is ready.
    // Example: callee joins with camera OFF -> we get a stream first, but must wait
    // for videoEnabled=false before showing header/timer to avoid a brief flash.
    ensureStartTime();
    dispatch(setCall({ ...callState, status: "Ongoing call" }));
  }, [callData?.isGroupCall, callData?.isVideoCall, callState, oneToOneRemote]);

  useEffect(() => {
    const participants = callData?.participants || [];
    const isTwoPartySession = participants.length <= 2;
    if (!isTwoPartySession) {
      setIsReconnecting(false);
      return;
    }
    if (!callState.isActive || callState.status === "Call ended") {
      setIsReconnecting(false);
      return;
    }
    if (!isOngoingCall) {
      setIsReconnecting(false);
      return;
    }

    const hasRemoteStream = remoteStreamsArray.length > 0;
    setIsReconnecting(!hasRemoteStream);
  }, [
    callData?.participants,
    callState.isActive,
    callState.status,
    isOngoingCall,
    remoteStreamsArray.length,
  ]);

  useEffect(() => {
    if (!callData?.isVideoCall || !callData?.isGroupCall) return;
    if (isCleaningUpRef.current) return;
    if (
      callState.status === "Ongoing call" ||
      callState.status === "Call ended"
    )
      return;
    if (remoteStreamsArray.length === 0) return;

    const anyTileReady = remoteStreamsArray.some(([userId]) =>
      isRemoteParticipantReadyForOngoing({
        participantUid: userId,
        remoteStreamPresent: true,
        videoPreferenceByUid: videoEnabledMap,
        screenShareByUid: screenSharingUids,
        readyStreamIds: readyRemoteStreamIds,
      })
    );

    if (!anyTileReady) return;

    // Group video: end "Waiting..." once any remote tile is ready
    // (e.g., a joiner has camera OFF, so no onPlaying until we receive videoEnabled=false).
    ensureStartTime();
    dispatch(setCall({ ...callState, status: "Ongoing call" }));
  }, [
    callData?.isGroupCall,
    callData?.isVideoCall,
    callState,
    remoteStreamsArray,
    readyRemoteStreamIds,
    screenSharingUids,
    videoEnabledMap,
  ]);

  // Update local and remote video/audio elements
  // Attach streams once when they become available - browser handles new tracks automatically
  useEffect(() => {
    // Don't re-attach streams during cleanup (prevents video from reappearing after hangup)
    if (isCleaningUpRef.current) {
      return;
    }

    // Local stream
    if (
      localVideoRef.current &&
      isLocalVideoActive &&
      localStreamRef.current &&
      !localVideoSwapInFlightRef.current &&
      localVideoRef.current.srcObject !== localStreamRef.current
    ) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    if (
      localVideoRef.current &&
      !isLocalVideoActive &&
      localVideoRef.current.srcObject
    ) {
      localVideoRef.current.srcObject = null;
    }
    if (
      localAudioRef.current &&
      localStreamRef.current &&
      localAudioRef.current.srcObject !== localStreamRef.current
    ) {
      localAudioRef.current.srcObject = localStreamRef.current;
    }

    const remoteStreams = remoteStreamsRef.current;
    if (!remoteStreams) return;

    const isGroupCall = callData?.isGroupCall;

    if (isGroupCall) {
      // Group call: Update all remote video elements
      remoteStreams.forEach((stream, userId) => {
        // Only attach if not already attached (browser handles new tracks automatically)
        if (!attachedStreamsRef.current.has(userId)) {
          let videoRef = remoteVideoRefsMap.current.get(userId);
          if (videoRef && videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            attachedStreamsRef.current.add(userId);
          }
        }
      });
    } else {
      // 1:1 call: Use single remote video/audio element
      if (remoteStreams.size > 0) {
        const firstRemoteStream = remoteStreams.values().next().value;
        if (firstRemoteStream) {
          // Only attach if different from current (browser handles new tracks automatically)
          if (
            remoteVideoRef.current &&
            remoteVideoRef.current.srcObject !== firstRemoteStream
          ) {
            remoteVideoRef.current.srcObject = firstRemoteStream;
          }
          if (
            remoteAudioRef.current &&
            remoteAudioRef.current.srcObject !== firstRemoteStream
          ) {
            remoteAudioRef.current.srcObject = firstRemoteStream;
          }
        }
      }
    }
  }, [
    localStreamRef,
    remoteStreamsRef,
    remoteStreamsArray, // This updates when streams are detected
    callData?.isGroupCall,
    isLocalVideoActive,
    screenSharingUids,
    videoEnabledMap,
  ]);

  useEffect(() => {
    if (!callData?.chatId) return;

    const chatRef = doc(db, "chats", callData.chatId);

    const unsubscribe = onSnapshot(chatRef, (docSnap) => {
      // Don't process updates if we're cleaning up
      if (isCleaningUpRef.current) {
        return;
      }
      const latestCallStatus = store.getState().chats.call.status;
      // Busy outcome statuses are local/transient (no live call doc was created),
      // so remote call state listeners should not transition it to "Call ended".
      if (
        latestCallStatus === "Line busy" ||
        latestCallStatus === "Everyone is busy"
      ) {
        return;
      }

      if (!docSnap.exists()) {
        return;
      }

      const callDataFromFirestore = docSnap.data().call;

      if (callDataFromFirestore) {
        const startTime =
          callDataFromFirestore?.callData?.startTime?.toDate?.() || null;
        if (startTime && !startTimeRef.current) {
          startTimeRef.current = startTime;
        }
        const screenSharingUidsFromFirestore =
          callDataFromFirestore.screenSharingUids || {};
        const videoEnabledFromFirestore =
          callDataFromFirestore?.callData?.videoEnabled || {};

        // If call ended in Firestore (isActive: false), close modal for remaining participants
        // Works for both 1:1 and group calls
        if (
          !isCleaningUpRef.current &&
          callState.isActive === true &&
          callDataFromFirestore &&
          callDataFromFirestore.isActive === false
        ) {
          if (localVideoRef.current?.srcObject)
            localVideoRef.current.srcObject = null;
          if (remoteVideoRef.current?.srcObject)
            remoteVideoRef.current.srcObject = null;

          // Set cleanup flag FIRST to prevent media `onPlaying` handlers
          // from re-setting the call status to "Ongoing call".
          isCleaningUpRef.current = true;

          dispatch(setCall({ ...callState, status: "Call ended" }));

          // Run cleanup immediately (match local hangup behavior)
          handleLocalCallCleanup();

          return;
        }

        // Only update state if not cleaning up (prevents jittering)
        if (!isCleaningUpRef.current) {
          setScreenSharingUids(screenSharingUidsFromFirestore);
          setVideoEnabledMap(videoEnabledFromFirestore);

          // For 1:1 calls: Check if remote is sharing
          if (!callData?.isGroupCall) {
            const otherParticipants = getOtherParticipants();
            if (otherParticipants.length > 0) {
              const remoteUid = otherParticipants[0];
              const remoteIsSharing =
                !!screenSharingUidsFromFirestore[remoteUid];
              setIsRemoteScreenSharing(remoteIsSharing);
            }
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [callData?.chatId]);

  useEffect(() => {
    if (!callState.isActive) {
      startTimeRef.current = null;
    }
  }, [callState.isActive, callData?.chatId]);

  useEffect(() => {
    if (startTimeRef.current || !callData?.startTime) return;
    if (callData.startTime instanceof Date) {
      startTimeRef.current = callData.startTime;
      return;
    }
    const parsed = new Date(callData.startTime);
    if (!Number.isNaN(parsed.getTime())) {
      startTimeRef.current = parsed;
    }
  }, [callData?.startTime]);

  const ensureStartTime = () => {
    if (!startTimeRef.current) {
      startTimeRef.current = new Date();
    }
  };

  const getCallStatusText = () => {
    if (!callData?.isVideoCall && !callData?.isGroupCall && isReconnecting) {
      return "Reconnecting...";
    }
    if (callState.status === "") {
      return isRejoinCall ? "Rejoin call" : "Incoming call";
    }
    return callState.status;
  };

  const formatCallDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const getElapsedSeconds = () => {
    if (!startTimeRef.current) return 0;
    const elapsedMs = Date.now() - startTimeRef.current.getTime();
    return Math.max(0, Math.floor(elapsedMs / 1000));
  };

  const handleLocalCallCleanup = async () => {
    // Note: isCleaningUpRef is set to true by hangUp() before calling this

    if (localAudioRef.current) {
      localAudioRef.current.srcObject = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    if (typeof cleanupLocalCall !== "function") {
      console.error(
        "[CallModal] ERROR: cleanupLocalCall is not a function!",
        cleanupLocalCall
      );
      isCleaningUpRef.current = false;
      return;
    }

    try {
      await cleanupLocalCall();
    } catch (error) {
      console.error("[CallModal] Error in cleanupLocalCall():", error);
      console.error("[CallModal] Error stack:", error.stack);
    } finally {
      // Only reset after cleanup is completely done
      // This prevents multiple simultaneous cleanup calls
      isCleaningUpRef.current = false;
    }
  };

  const getCallStatus = (userForStatus, timer) => {
    const isUserInitiator = userForStatus.uid === callData?.initiator;
    const didInitiatorHangUp = user.uid === callData?.initiator;

    if (timer > 0) {
      return isUserInitiator ? "Outgoing call" : "Incoming call";
    }

    if (isUserInitiator) {
      return didInitiatorHangUp ? "Cancelled call" : "Declined call";
    } else {
      return didInitiatorHangUp ? "Missed call" : "Declined call";
    }
  };

  const hangUp = async () => {
    // Set cleanup flag IMMEDIATELY to prevent race conditions
    // (useEffect re-attaching streams, onPlaying resetting status)
    isCleaningUpRef.current = true;

    if (!isUserInCall) {
      stopPreviewStream();
    }

    // Set UI status immediately for user feedback
    dispatch(setCall({ ...callState, status: "Call ended" }));

    // Clear video elements immediately
    if (localVideoRef.current?.srcObject) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current?.srcObject) {
      remoteVideoRef.current.srcObject = null;
    }
    // For group calls, hide the video grid so "Call ended" is visible
    setRemoteStreamsArray([]);

    // Build status object and send msg only for 1:1 calls
    if (!callData?.isGroupCall) {
      const durationSeconds = getElapsedSeconds();
      const status = {};
      if (callData?.participantDetails) {
        Object.keys(callData.participantDetails).forEach((uid) => {
          status[uid] = getCallStatus({ uid }, durationSeconds);
        });
      }

      const initiatorInfo = getParticipantInfo(callData?.initiator) || user;
      sendOneToOneCallHistoryMsg({
        db,
        chatId: callData.chatId,
        initiatorInfo,
        statusByUid: status,
        durationSeconds,
        isVideoCall: callData.isVideoCall,
        senderUid: user.uid,
      }).catch((error) => {
        console.error("[CallModal] Error sending call history message:", error);
      });
    }

    // Let useWebRTC.cleanupLocalCall() handle Firestore updates
    // It will:
    // - Remove self from participants
    // - Clear screenSharingUids
    // - Set isActive = false and clear callData if no participants left
    // - Clean up peer connections and streams

    handleLocalCallCleanup().catch((error) => {
      console.error(
        "[CallModal] Unhandled error in handleLocalCallCleanup():",
        error
      );
    });
  };

  // Keep a live reference to the latest hangUp implementation for timeout callbacks.
  // Timeout handlers run later, so calling hangUp directly there would use a stale
  // render closure (hangup will receive old states and props from the time the timeout was set).
  useEffect(() => {
    latestHangUpRef.current = hangUp;
  }, [hangUp]);

  // Auto-end unanswered outgoing call:
  // initiator-only, armed once per call session, cleared as soon as any callee joins
  // or call transitions to ongoing/ended.
  useEffect(() => {
    const participants = callData?.participants || [];
    const isInitiatorUser = callData?.initiator === user.uid;
    const hasAnyAnswerer = participants.some((uid) => uid !== user.uid);
    const shouldArmNoAnswerTimeout =
      callState.isActive &&
      callState.status !== "Call ended" &&
      callState.status !== "Ongoing call" &&
      !isBusyOutcomeStatus &&
      isInitiatorUser &&
      !hasAnyAnswerer;

    if (!shouldArmNoAnswerTimeout) {
      if (noAnswerHangupTimeoutRef.current) {
        clearTimeout(noAnswerHangupTimeoutRef.current);
        noAnswerHangupTimeoutRef.current = null;
      }
      return;
    }

    // This avoids resetting countdown on harmless re-renders/status changes
    // (for example when status changes from "Calling..." to "Ringing...").
    if (noAnswerHangupTimeoutRef.current) {
      return;
    }

    noAnswerHangupTimeoutRef.current = setTimeout(() => {
      noAnswerHangupTimeoutRef.current = null;

      const latestCall = store.getState().chats.call;
      const latestParticipants = latestCall.callData?.participants || [];
      const stillUnanswered =
        latestCall.isActive &&
        latestCall.status !== "Call ended" &&
        latestCall.status !== "Ongoing call" &&
        latestCall.callData?.initiator === user.uid &&
        latestCall.status !== "Line busy" &&
        latestCall.status !== "Everyone is busy" &&
        latestParticipants.every((uid) => uid === user.uid);

      if (!stillUnanswered) {
        return;
      }

      latestHangUpRef.current?.();
    }, NO_ANSWER_AUTO_HANGUP_MS);
  }, [
    callData?.initiator,
    callData?.participants,
    callState.isActive,
    callState.status,
    isBusyOutcomeStatus,
    user.uid,
  ]);

  // Unmount-only timer cleanup for this modal instance.
  // mount: registers the cleanup function.
  // unmount: executes cleanup and clears any pending auto-hangup timers.
  // Needed because setTimeout callbacks from an unmounted instance can still fire
  // later unless we explicitly clear them.
  useEffect(
    () => () => {
      if (noAnswerHangupTimeoutRef.current) {
        clearTimeout(noAnswerHangupTimeoutRef.current);
        noAnswerHangupTimeoutRef.current = null;
      }
      if (reconnectHangupTimeoutRef.current) {
        clearTimeout(reconnectHangupTimeoutRef.current);
        reconnectHangupTimeoutRef.current = null;
      }
    },
    []
  );

  // Auto-end if reconnecting state persists too long.
  // Starts only while reconnecting indicator is visible and clears immediately
  // once remote media returns.
  useEffect(() => {
    const participants = callData?.participants || [];
    const isTwoPartySession = participants.length <= 2;
    const shouldArmReconnectTimeout =
      isTwoPartySession &&
      callState.isActive &&
      callState.status === "Ongoing call" &&
      isReconnecting;

    if (!shouldArmReconnectTimeout) {
      if (reconnectHangupTimeoutRef.current) {
        clearTimeout(reconnectHangupTimeoutRef.current);
        reconnectHangupTimeoutRef.current = null;
      }
      return;
    }

    if (reconnectHangupTimeoutRef.current) {
      return;
    }

    reconnectHangupTimeoutRef.current = setTimeout(() => {
      reconnectHangupTimeoutRef.current = null;

      const latestCall = store.getState().chats.call;
      const latestParticipants = latestCall.callData?.participants || [];
      const stillReconnecting =
        latestCall.isActive &&
        latestCall.status === "Ongoing call" &&
        latestParticipants.length <= 2 &&
        (remoteStreamsRef.current?.size || 0) === 0;

      if (!stillReconnecting) {
        return;
      }

      latestHangUpRef.current?.();
    }, RECONNECT_AUTO_HANGUP_MS);
  }, [
    callData?.participants,
    callState.isActive,
    callState.status,
    isReconnecting,
    remoteStreamsRef,
  ]);

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current
      .getAudioTracks()
      .forEach((track) => (track.enabled = !track.enabled));
    setIsMuted((prev) => !prev);
  };

  const fadeLocalVideo = (fadeOut) => {
    if (localVideoFadeTimeoutRef.current) {
      clearTimeout(localVideoFadeTimeoutRef.current);
      localVideoFadeTimeoutRef.current = null;
    }
    if (fadeOut) {
      setIsLocalVideoFading(true);
      return;
    }
    // Slight delay lets the new stream paint before fading back in.
    localVideoFadeTimeoutRef.current = setTimeout(() => {
      setIsLocalVideoFading(false);
      localVideoFadeTimeoutRef.current = null;
    }, 150);
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      const previousLocalStream = localStreamRef.current;
      manualScreenShareStopRef.current = true;
      localVideoSwapInFlightRef.current = true;
      fadeLocalVideo(true);
      setIsScreenSharing(false);
      try {
        const stream = await stopScreenShare(!isLocalVideoEnabled);
        if (!stream) {
          setIsScreenSharing(true);
          return;
        }
        if (stream && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        if (previousLocalStream && previousLocalStream !== stream) {
          previousLocalStream.getVideoTracks().forEach((t) => t.stop());
        }
      } finally {
        localVideoSwapInFlightRef.current = false;
        manualScreenShareStopRef.current = false;
        fadeLocalVideo(false);
      }
    } else {
      const previousLocalStream = localStreamRef.current;
      localVideoSwapInFlightRef.current = true;
      fadeLocalVideo(true);
      const stream = await startScreenShare();
      if (!stream) {
        localVideoSwapInFlightRef.current = false;
        fadeLocalVideo(false);
        return;
      }
      setIsScreenSharing(true);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      if (previousLocalStream && previousLocalStream !== stream) {
        previousLocalStream.getVideoTracks().forEach((t) => t.stop());
      }
      localVideoSwapInFlightRef.current = false;
      fadeLocalVideo(false);

      stream.getVideoTracks()[0].onended = async () => {
        if (manualScreenShareStopRef.current) return;
        const previousStream = localStreamRef.current;
        localVideoSwapInFlightRef.current = true;
        fadeLocalVideo(true);
        setIsScreenSharing(false);
        const restoredStream = await stopScreenShare(!isLocalVideoEnabled);
        if (restoredStream && localVideoRef.current) {
          localVideoRef.current.srcObject = restoredStream;
        }
        if (previousStream && previousStream !== restoredStream) {
          previousStream.getVideoTracks().forEach((t) => t.stop());
        }
        localVideoSwapInFlightRef.current = false;
        fadeLocalVideo(false);
      };
    }
  };

  const toggleVideo = async () => {
    if (!callData?.isVideoCall) return;
    if (isScreenSharing || isTogglingVideoRef.current) return;

    isTogglingVideoRef.current = true;
    const isConnectedToCallMedia = !!localStreamRef.current;
    const getVideoSender = (pc) => {
      const transceiver = pc
        .getTransceivers?.()
        ?.find((t) => t.receiver?.track?.kind === "video");
      if (transceiver?.sender) return transceiver.sender;
      return pc.getSenders().find((s) => s.track?.kind === "video");
    };
    const getAudioSender = (pc) => {
      const transceiver = pc
        .getTransceivers?.()
        ?.find((t) => t.receiver?.track?.kind === "audio");
      if (transceiver?.sender) return transceiver.sender;
      return pc.getSenders().find((s) => s.track?.kind === "audio");
    };
    try {
      const activeStream = isConnectedToCallMedia
        ? localStreamRef.current
        : previewStreamRef.current;
      if (!activeStream) return;

      const stopLiveVideoTracks = (stream) => {
        if (!stream) return;
        stream.getVideoTracks().forEach((track) => {
          if (track.readyState === "live") {
            track.stop();
            if (typeof stream.removeTrack === "function") {
              stream.removeTrack(track);
            }
          }
        });
      };

      const audioTracks = activeStream.getAudioTracks();
      if (isLocalVideoEnabled) {
        if (localVideoRef.current) {
          localVideoRef.current.style.display = "none";
        }
        stopLiveVideoTracks(activeStream);
        if (isConnectedToCallMedia) {
          // Mid-call OFF: switch to a fresh audio-only capture session and send null video.
          // This reliably releases camera hardware while keeping mic live.
          let replacementAudioTrack = audioTracks[0] || null;
          try {
            const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false,
            });
            const freshAudioTrack = audioOnlyStream.getAudioTracks()[0];
            if (freshAudioTrack) {
              replacementAudioTrack = freshAudioTrack;
            }
          } catch (error) {
            console.warn(
              "[CallModal] toggleVideo OFF could not acquire fresh audio-only stream, reusing current audio track:",
              error
            );
          }

          const replacePromises = [];
          peerConnectionsRef.current.forEach((pc) => {
            const videoSender = getVideoSender(pc);
            if (videoSender) {
              replacePromises.push(videoSender.replaceTrack(null));
            }
            const audioSender = getAudioSender(pc);
            if (audioSender && replacementAudioTrack) {
              replacePromises.push(
                audioSender.replaceTrack(replacementAudioTrack)
              );
            }
          });
          await Promise.all(replacePromises);

          // Stop old capture tracks, but keep the replacement audio track alive.
          activeStream.getTracks().forEach((track) => {
            if (
              track !== replacementAudioTrack &&
              track.readyState === "live"
            ) {
              track.stop();
            }
          });

          localStreamRef.current = replacementAudioTrack
            ? new MediaStream([replacementAudioTrack])
            : new MediaStream();
          // Don't block local camera release on Firestore latency.
          updateVideoEnabled(false);
        } else {
          // Pre-join OFF: rebuild preview with a fresh audio-only stream so camera
          // capture session is released immediately.
          let nextPreviewStream = null;
          try {
            const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false,
            });
            if (audioOnlyStream.getAudioTracks().length > 0) {
              nextPreviewStream = audioOnlyStream;
            }
          } catch (error) {
            console.warn(
              "[CallModal] toggleVideo OFF pre-join audio-only getUserMedia failed, falling back to existing audio track:",
              error
            );
          }
          if (!nextPreviewStream) {
            nextPreviewStream = new MediaStream([...audioTracks]);
          }
          activeStream.getTracks().forEach((track) => {
            if (track.readyState === "live") {
              track.stop();
            }
          });
          setPreJoinVideoEnabled(false);
          setVideoEnabledMap((prev) => ({ ...prev, [user.uid]: false }));
          // Pre-join preview should be audio-only when video is off.
          // Join flow may add a dummy video track so remote frame readiness
          // logic can still advance to ongoing call state.
          previewStreamRef.current = nextPreviewStream;
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
      } else {
        let cameraStream;
        try {
          cameraStream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
        } catch (error) {
          console.error("[CallModal] Error enabling camera:", error);
          notifyUser(
            getMediaPermissionMessage({ error, isAudioCall: false }),
            "info"
          );
          isTogglingVideoRef.current = false;
          return;
        }
        const cameraTrack = cameraStream.getVideoTracks()[0];
        if (isConnectedToCallMedia) {
          peerConnectionsRef.current.forEach((pc) => {
            const sender = getVideoSender(pc);
            if (sender) sender.replaceTrack(cameraTrack);
          });
          stopLiveVideoTracks(localStreamRef.current);
          localStreamRef.current = new MediaStream([
            cameraTrack,
            ...audioTracks,
          ]);
        } else {
          stopLiveVideoTracks(activeStream);
          previewStreamRef.current = new MediaStream([
            cameraTrack,
            ...audioTracks,
          ]);
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = isConnectedToCallMedia
            ? localStreamRef.current
            : previewStreamRef.current;
          localVideoRef.current.style.display = "";
        }
        if (isConnectedToCallMedia) {
          await updateVideoEnabled(true);
        } else {
          setPreJoinVideoEnabled(true);
          setVideoEnabledMap((prev) => ({ ...prev, [user.uid]: true }));
        }
      }
    } catch (error) {
      console.error("[CallModal] Error toggling video:", error);
    } finally {
      isTogglingVideoRef.current = false;
    }
  };

  const handleMouseDown = (e) => {
    dragging.current = true;
    dragOffset.current = {
      x: e.clientX - modalRef.current.offsetLeft,
      y: e.clientY - modalRef.current.offsetTop,
    };
  };

  const handleMouseMove = (e) => {
    if (!dragging.current) return;
    modalRef.current.style.left = `${e.clientX - dragOffset.current.x}px`;
    modalRef.current.style.top = `${e.clientY - dragOffset.current.y}px`;
  };

  const handleMouseUp = () => {
    dragging.current = false;
  };

  return (
    <Box
      ref={modalRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      sx={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 2000,
        width: { xs: 380, sm: 725 },
        height: 540,
        p: 2,
        bgcolor: "#20232A",
        overflow: "hidden",
        borderRadius: 2,
        boxShadow: 4,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.5,
        cursor: "grab",
        userSelect: "none",
      }}
    >
      <Box
        sx={{
          display:
            isOngoingCall && (callData?.isVideoCall || callData?.isGroupCall)
              ? "none"
              : "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          pt: 2,
          position: "relative",
          zIndex: 3,
          visibility:
            isRemoteScreenSharing && isOngoingCall ? "hidden" : "visible",
        }}
      >
        <Avatar
          src={
            callData?.isGroupCall
              ? undefined
              : getPrimaryRemoteParticipant()?.photoURL || undefined
          }
          sx={{ width: 75, height: 75, mb: 1 }}
        >
          {callData?.isGroupCall && chat.displayName.charAt(0)}
        </Avatar>
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="h3" fontSize="1.625rem" color="#fff">
            {callData?.isGroupCall
              ? chat?.displayName || "Group Call"
              : getPrimaryRemoteParticipant()?.displayName?.split(" ")[0] ||
                "Unknown"}
          </Typography>
          <Typography variant="subtitle1" fontWeight="normal" color="#d6d6c2">
            {callData?.isGroupCall &&
            isInitiator() &&
            !isOngoingCall &&
            callState.status !== "Call ended" &&
            !isBusyOutcomeStatus
              ? "Waiting..."
              : getCallStatusText()}
          </Typography>
          {callData?.isGroupCall &&
            isInitiator() &&
            !isOngoingCall &&
            callState.status !== "Call ended" &&
            !isBusyOutcomeStatus &&
            !!groupBusyInfoLabel && (
              <Typography
                variant="body2"
                sx={{ mt: 0.25, fontSize: "0.8rem", color: "#b7c1d1" }}
              >
                {groupBusyInfoLabel}
              </Typography>
            )}
        </Box>
        <Typography
          variant="body2"
          sx={{
            color: "#d6d6c2",
            visibility: isOngoingCall ? "visible" : "hidden",
          }}
        >
          <CallDuration
            startTime={startTimeRef.current}
            visible={isOngoingCall}
            formatCallDuration={formatCallDuration}
          />
        </Typography>
      </Box>
      {callData.isVideoCall ? (
        <>
          {callData.isGroupCall && (
            // GROUP CALL: Grid Layout (Remote Only)
            <>
              <Box
                sx={{
                  position: "absolute",
                  top: "25px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  bgcolor: "rgba(0, 0, 0, 0.3)",
                  backdropFilter: "blur(5px)",
                  color: "white",
                  fontSize: "0.875rem",
                  borderRadius: "10px",
                  px: 1.5,
                  py: 0.5,
                  display: isOngoingCall ? "flex" : "none",
                  gap: 1,
                  justifyContent: "space-between",
                  alignItems: "center",
                  zIndex: 2,
                }}
              >
                <span>{remoteStreamsArray.length + 1} participant(s)</span>
                <span> | </span>
                <span>
                  <CallDuration
                    startTime={startTimeRef.current}
                    visible={isOngoingCall}
                    formatCallDuration={formatCallDuration}
                  />
                </span>
              </Box>
              {isReconnecting && (
                <ReconnectingBadge
                  sx={{
                    position: "absolute",
                    top: "68px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 2,
                  }}
                />
              )}

              {/* Grid Container (Remote Participants ONLY) */}
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  display:
                    (isOngoingCall || isInitiator()) &&
                    callState.status !== "Call ended"
                      ? "grid"
                      : "none",
                  gridTemplateColumns:
                    readyRemoteStreamsArray.length === 0
                      ? "1fr" // No remote (Waiting): Local is PiP, Grid empty/hidden
                      : readyRemoteStreamsArray.length === 1
                      ? "1fr" // 1 Remote
                      : "1fr 1fr", // 2+ Remote
                  gridTemplateRows:
                    readyRemoteStreamsArray.length <= 2
                      ? "1fr" // 1-2 Remote
                      : readyRemoteStreamsArray.length <= 4
                      ? "1fr 1fr" // 3-4 Remote
                      : "1fr 1fr 1fr", // 5+ Remote
                  gap: "2px",
                  zIndex: 1,
                }}
              >
                {/* Remote Videos */}
                {remoteStreamsArray.map(([userId, stream]) => {
                  // Get or create ref for this user
                  if (!remoteVideoRefsMap.current.has(userId)) {
                    remoteVideoRefsMap.current.set(userId, { current: null });
                  }
                  const videoRef = remoteVideoRefsMap.current.get(userId);
                  const participantInfo = getParticipantInfo(userId);
                  const displayName =
                    participantInfo?.displayName?.split(" ")[0] ||
                    "Participant";
                  const isThisUserSharing = !!screenSharingUids[userId];
                  const hasVideoPreference =
                    Object.prototype.hasOwnProperty.call(
                      videoEnabledMap,
                      userId
                    );
                  const isVideoEnabled = hasVideoPreference
                    ? videoEnabledMap[userId] !== false || isThisUserSharing
                    : false;
                  const isVideoOff = hasVideoPreference && !isVideoEnabled;
                  const isReady = isRemoteParticipantReadyForOngoing({
                    participantUid: userId,
                    remoteStreamPresent: true,
                    videoPreferenceByUid: videoEnabledMap,
                    screenShareByUid: screenSharingUids,
                    readyStreamIds: readyRemoteStreamIds,
                  });
                  const shouldShowParticipantTile = isOngoingCall && isReady;

                  return (
                    <Box
                      key={userId}
                      sx={{
                        position: shouldShowParticipantTile
                          ? "relative"
                          : "absolute",
                        top: shouldShowParticipantTile ? "auto" : 0,
                        left: shouldShowParticipantTile ? "auto" : 0,
                        width: shouldShowParticipantTile ? "100%" : "1px",
                        height: shouldShowParticipantTile ? "100%" : "1px",
                        backgroundColor: "#1a1a1a",
                        borderRadius: "4px",
                        overflow: "hidden",
                        opacity: shouldShowParticipantTile ? 1 : 0,
                        pointerEvents: shouldShowParticipantTile
                          ? "auto"
                          : "none",
                      }}
                    >
                      <video
                        ref={(el) => {
                          if (videoRef) videoRef.current = el;
                          // Determine if we need to update srcObject
                          // Only update if element exists, stream exists, AND it's different
                          if (el && stream && el.srcObject !== stream) {
                            el.srcObject = stream;
                          }
                        }}
                        autoPlay
                        playsInline
                        muted={!isVideoEnabled}
                        onPlaying={() =>
                          markRemoteFrameReady(userId, videoRef?.current)
                        }
                        style={{
                          width:
                            shouldShowParticipantTile && isVideoEnabled
                              ? "100%"
                              : "1px",
                          height:
                            shouldShowParticipantTile && isVideoEnabled
                              ? "100%"
                              : "1px",
                          objectFit: isThisUserSharing ? "contain" : "cover",
                          opacity:
                            shouldShowParticipantTile && isVideoEnabled ? 1 : 0,
                          position:
                            shouldShowParticipantTile && isVideoEnabled
                              ? "static"
                              : "absolute",
                          pointerEvents:
                            shouldShowParticipantTile && isVideoEnabled
                              ? "auto"
                              : "none",
                        }}
                      />
                      {shouldShowParticipantTile && !isVideoEnabled && (
                        <audio
                          ref={(el) => {
                            if (el && stream && el.srcObject !== stream) {
                              el.srcObject = stream;
                            }
                          }}
                          autoPlay
                        />
                      )}
                      {isVideoEnabled ? (
                        <Box
                          sx={{
                            position: "absolute",
                            bottom: 4,
                            left: 4,
                            bgcolor: "rgba(0, 0, 0, 0.5)",
                            color: "white",
                            px: 1,
                            py: 0.5,
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                          }}
                        >
                          {displayName}
                        </Box>
                      ) : (
                        <Box
                          sx={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            gap: 1,
                            color: "white",
                            backgroundColor: "#2A2F3A",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            borderRadius: "12px",
                          }}
                        >
                          <Avatar
                            src={participantInfo?.photoURL || undefined}
                            sx={{ width: 72, height: 72 }}
                          >
                            {displayName.charAt(0)}
                          </Avatar>
                          <Typography
                            variant="body2"
                            sx={{ fontSize: "0.85rem" }}
                          >
                            {displayName}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </>
          )}

          {/* 1:1 Remote Video (Only if NOT Group Call) */}
          {!callData.isGroupCall && (
            <>
              {(() => {
                const remoteUid = oneToOneRemote.remoteUid;
                const shouldRenderRemoteVideo =
                  oneToOneRemote.shouldRenderRemoteVideo;
                const remoteInfo = getParticipantInfo(remoteUid);
                const remoteName =
                  remoteInfo?.displayName?.split(" ")[0] || "Unknown";

                return (
                  <>
                    <Box
                      sx={{
                        position: "absolute",
                        top: "25px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        display: isOngoingCall ? "flex" : "none",
                        flexDirection: "column",
                        gap: 1,
                        alignItems: "center",
                        zIndex: 2,
                      }}
                    >
                      <Box
                        sx={{
                          bgcolor: "rgba(0, 0, 0, 0.3)",
                          backdropFilter: "blur(5px)",
                          color: "white",
                          fontSize: "0.875rem",
                          borderRadius: "10px",
                          px: 1.5,
                          py: 0.5,
                          display: "flex",
                          gap: 1,
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span>{remoteName}</span>
                        <span> | </span>
                        <span>
                          <CallDuration
                            startTime={startTimeRef.current}
                            visible={isOngoingCall}
                            formatCallDuration={formatCallDuration}
                          />
                        </span>
                      </Box>
                      {isReconnecting && <ReconnectingBadge />}
                    </Box>
                    {shouldRenderRemoteVideo === false && (
                      <Box
                        sx={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          display: isOngoingCall ? "flex" : "none",
                          flexDirection: "column",
                          justifyContent: "center",
                          alignItems: "center",
                          gap: 1,
                          zIndex: 1,
                          color: "white",
                          backgroundColor: "#2A2F3A",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          borderRadius: "12px",
                        }}
                      >
                        <Avatar
                          src={remoteInfo?.photoURL || undefined}
                          sx={{ width: 96, height: 96 }}
                        >
                          {remoteName.charAt(0)}
                        </Avatar>
                        <Typography variant="body2" sx={{ fontSize: "1rem" }}>
                          {remoteName}
                        </Typography>
                      </Box>
                    )}
                    <video
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: isRemoteScreenSharing ? "contain" : "cover",
                        transform: "scaleX(1)",
                        borderRadius: 0,
                        display:
                          isOngoingCall && shouldRenderRemoteVideo
                            ? "block"
                            : "none",
                        zIndex: 1,
                      }}
                      onPlaying={() => {
                        if (remoteUid) {
                          markRemoteFrameReady(
                            remoteUid,
                            remoteVideoRef.current
                          );
                        }
                      }}
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      muted={shouldRenderRemoteVideo === false}
                    />
                    {shouldRenderRemoteVideo === false && (
                      <audio ref={remoteAudioRef} autoPlay />
                    )}
                  </>
                );
              })()}
            </>
          )}

          {callData.isVideoCall && !isLocalVideoActive && (
            <Box
              sx={{
                position: "absolute",
                left: "50%",
                top: 250,
                display: callState.status === "Call ended" ? "none" : "flex",
                width: 248,
                height: 185,
                backgroundColor: "#2A2F3A",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "12px",
                overflow: "hidden",
                boxShadow: isOngoingCall ? "0 0 5px rgba(0, 0, 0, 0.3)" : "",
                transform: isOngoingCall
                  ? isMobile
                    ? `translate(0px, 60px) scale(0.5)`
                    : `translate(140px, 120px) scale(0.7)`
                  : `translateX(-50%) scale(1)`,
                transition: "transform .3s ease-out",
                zIndex: 3,
                marginBottom: isOngoingCall ? "0" : ".625rem",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                gap: 1,
                color: "white",
              }}
            >
              <Avatar
                src={user.photoURL || undefined}
                sx={{ width: 72, height: 72 }}
              >
                {user.displayName?.charAt(0) || "Y"}
              </Avatar>
              <Typography variant="body2" sx={{ fontSize: "0.9rem" }}>
                You
              </Typography>
            </Box>
          )}

          {/* Local Video - Rendered for BOTH modes (unification) */}
          <video
            style={{
              position: "absolute",
              left: "50%",
              top: 250,
              display:
                callState.status === "Call ended" || !isLocalVideoActive
                  ? "none"
                  : "block",
              width: 248,
              height: 185,
              backgroundColor: isScreenSharing ? "#1a1a1a" : "transparent",
              borderRadius: "10px",
              overflow: "hidden",
              boxShadow: isOngoingCall ? "0 0 5px rgba(0, 0, 0, 0.3)" : "",
              transform: isOngoingCall
                ? isMobile
                  ? `translate(0px, 60px) scale(0.5) scaleX(${
                      isScreenSharing ? 1 : -1
                    })`
                  : `translate(140px, 120px) scale(0.7) scaleX(${
                      isScreenSharing ? 1 : -1
                    })`
                : `translateX(-50%) scale(1) scaleX(-1)`,
              transition: "transform .3s ease-out, opacity .2s ease",
              opacity: isLocalVideoFading || isLocalVideoIntro ? 0 : 1,
              zIndex: 3, // Higher Z-Index than remote content
              marginBottom: isOngoingCall ? "0" : ".625rem",
            }}
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            onPlaying={() => {
              if (isLocalVideoIntro) {
                setIsLocalVideoIntro(false);
              }
            }}
          />
        </>
      ) : (
        <>
          {callData.isGroupCall ? (
            <>
              {/* Group Audio: Top status + timer */}
              <Box
                sx={{
                  position: "absolute",
                  top: "25px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  bgcolor: "rgba(0, 0, 0, 0.3)",
                  backdropFilter: "blur(5px)",
                  color: "white",
                  fontSize: "0.875rem",
                  borderRadius: "10px",
                  px: 1.5,
                  py: 0.5,
                  display: isOngoingCall ? "flex" : "none",
                  gap: 1,
                  justifyContent: "space-between",
                  alignItems: "center",
                  zIndex: 2,
                }}
              >
                <span>{remoteStreamsArray.length + 1} participant(s)</span>
                <span> | </span>
                <span>
                  <CallDuration
                    startTime={startTimeRef.current}
                    visible={isOngoingCall}
                    formatCallDuration={formatCallDuration}
                  />
                </span>
              </Box>
              {isReconnecting && (
                <ReconnectingBadge
                  sx={{
                    position: "absolute",
                    top: "68px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 2,
                  }}
                />
              )}

              {/* Group Audio: Remote Participants Grid */}
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  display:
                    (isOngoingCall || isInitiator()) && //?
                    callState.status !== "Call ended"
                      ? "grid"
                      : "none",
                  gridTemplateColumns:
                    remoteStreamsArray.length <= 9
                      ? "1fr 1fr 1fr"
                      : "1fr 1fr 1fr",
                  gridTemplateRows:
                    remoteStreamsArray.length <= 9
                      ? "1fr 1fr 1fr"
                      : "1fr 1fr 1fr 1fr",
                  gap: "8px",
                  padding: "72px 24px 24px",
                  zIndex: 1,
                }}
              >
                {remoteStreamsArray.map(([userId]) => {
                  const participantInfo = getParticipantInfo(userId);
                  const displayName =
                    participantInfo?.displayName?.split(" ")[0] ||
                    "Participant";
                  return (
                    <Box
                      key={userId}
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: "#2A2F3A",
                        borderRadius: "12px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        overflow: "hidden",
                        gap: 1,
                        width: "100%",
                        height: "100%",
                      }}
                    >
                      <Avatar
                        src={participantInfo?.photoURL || undefined}
                        sx={{ width: 72, height: 72 }}
                      >
                        {displayName.charAt(0)}
                      </Avatar>
                      <Typography
                        variant="body2"
                        sx={{ color: "white", fontSize: "0.85rem" }}
                      >
                        {displayName}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>

              {/* Group Audio: Remote audio elements */}
              {remoteStreamsArray.map(([userId, stream]) => (
                <audio
                  key={`audio-${userId}`}
                  ref={(el) => {
                    if (el && stream && el.srcObject !== stream) {
                      el.srcObject = stream;
                    }
                  }}
                  autoPlay
                  onPlaying={() => {
                    ensureStartTime();
                    markRemoteStreamReady(userId);
                    if (!isCleaningUpRef.current) {
                      dispatch(
                        setCall({ ...callState, status: "Ongoing call" })
                      );
                    }
                  }}
                />
              ))}

              <audio ref={localAudioRef} autoPlay muted />
            </>
          ) : (
            <>
              <audio ref={localAudioRef} autoPlay muted />
              <audio
                ref={remoteAudioRef}
                autoPlay
                onPlaying={() => {
                  ensureStartTime();
                  if (!isCleaningUpRef.current) {
                    dispatch(setCall({ ...callState, status: "Ongoing call" }));
                  }
                }}
              />
            </>
          )}
        </>
      )}

      <Box
        sx={{
          position: "absolute",
          top: "86%",
          left: "50%",
          transform: "translateX(-50%)",
          display:
            callState.status === "Call ended" || isBusyOutcomeStatus
              ? "none"
              : "flex",
          gap: 2,
          zIndex: 2,
        }}
      >
        {callState?.status === "" && (!isInitiator() || isRejoinCall) && (
          <IconButton
            onClick={async () => {
              const latestCall = store.getState().chats.call;
              if (latestCall.status === "") {
                dispatch(
                  setCall({
                    ...latestCall,
                    status: "Connecting...",
                  })
                );
              }
              await joinCall(previewStreamRef.current, isLocalVideoEnabled);
            }}
            disabled={callData.isVideoCall && previewPermissionDenied}
            sx={{
              bgcolor: "success.main",
              color: "#fff",
              width: 48,
              height: 48,

              "&:hover": {
                bgcolor: "success.main",
              },
              "&.MuiButtonBase-root:hover": {
                bgcolor: "success.main",
              },
              "&.Mui-disabled": {
                bgcolor: controlButtonBg,
                color: controlButtonColor,
                opacity: 0.4,
              },
            }}
            disableRipple
          >
            <Call sx={{ fontSize: "1.5rem" }} />
          </IconButton>
        )}

        {callData.isVideoCall && (
          <IconButton
            onClick={toggleVideo}
            disabled={isVideoControlDisabled}
            sx={{
              width: 48,
              height: 48,
              display: shouldShowVideoToggle ? "flex" : "none",
              pointerEvents: isVideoControlDisabled ? "none" : "auto",
              bgcolor: videoControlBg,
              color: videoControlColor,
              opacity: videoControlOpacity,
              boxShadow: "0 0 5px rgba(0, 0, 0, 0.3)",
              transition:
                isConnectingCall || !isOngoingCall
                  ? "none"
                  : "opacity 0.2s ease, background-color 0.2s ease",
              "&:hover": {
                bgcolor: videoControlBg,
              },
              "&.MuiButtonBase-root:hover": {
                bgcolor: videoControlBg,
              },
              "&.Mui-disabled": {
                bgcolor: `${videoControlBg} !important`,
                color: `${videoControlColor} !important`,
                opacity: `${videoControlOpacity} !important`,
              },
            }}
            disableRipple
          >
            {isLocalVideoEnabled ? (
              <Videocam sx={{ fontSize: "1.5rem" }} />
            ) : (
              <VideocamOff sx={{ fontSize: "1.5rem" }} />
            )}
          </IconButton>
        )}

        {callData.isVideoCall && (
          <IconButton
            onClick={toggleScreenShare}
            disabled={isScreenShareControlDisabled}
            sx={{
              width: 48,
              height: 48,
              display:
                callState.status === "" ||
                (!isInitiator() && !isOngoingCall && !isConnectingCall)
                  ? "none"
                  : "flex",
              bgcolor: screenShareControlBg,
              color: screenShareControlColor,
              pointerEvents: isScreenShareControlDisabled ? "none" : "auto",
              opacity: screenShareControlOpacity,
              boxShadow: "0 0 5px rgba(0, 0, 0, 0.3)",
              transition: "background-color 0.2s ease",
              "&:hover": {
                bgcolor: screenShareControlBg,
              },
              "&.MuiButtonBase-root:hover": {
                bgcolor: screenShareControlBg,
              },
              "&.Mui-disabled": {
                bgcolor: `${screenShareControlBg} !important`,
                color: `${screenShareControlColor} !important`,
                opacity: `${screenShareControlOpacity} !important`,
              },
            }}
            disableRipple
          >
            <ScreenShare sx={{ fontSize: "1.5rem" }} />
          </IconButton>
        )}

        <IconButton
          onClick={toggleMute}
          disabled={isMuteControlDisabled}
          sx={{
            width: 48,
            height: 48,
            display:
              callState.status === "" ||
              (!isInitiator() && !isOngoingCall && !isConnectingCall)
                ? "none"
                : "flex",
            bgcolor: muteControlBg,
            color: muteControlColor,
            pointerEvents: isMuteControlDisabled ? "none" : "auto",
            opacity: muteControlOpacity,
            boxShadow: "0 0 5px rgba(0, 0, 0, 0.3)",
            transition: "background-color 0.2s ease",
            "&:hover": {
              bgcolor: muteControlBg,
            },
            "&.MuiButtonBase-root:hover": {
              bgcolor: muteControlBg,
            },
            "&.Mui-disabled": {
              bgcolor: `${muteControlBg} !important`,
              color: `${muteControlColor} !important`,
              opacity: `${muteControlOpacity} !important`,
            },
          }}
          disableRipple
        >
          {isMuted ? (
            <MicOff sx={{ fontSize: "1.5rem" }} />
          ) : (
            <Mic sx={{ fontSize: "1.5rem" }} />
          )}
        </IconButton>

        <IconButton
          onClick={hangUp}
          sx={{
            bgcolor: "error.main",
            color: "#fff",
            width: 48,
            height: 48,

            "&:hover": {
              bgcolor: "error.main",
            },
            "&.MuiButtonBase-root:hover": {
              bgcolor: "error.main",
            },
          }}
          disableRipple
        >
          <CallEnd sx={{ fontSize: "1.5rem" }} />
        </IconButton>
      </Box>
    </Box>
  );
};

CallModal.propTypes = {
  peerConnectionsRef: PropTypes.shape({
    current: PropTypes.instanceOf(Map), // Map<userId, RTCPeerConnection>
  }),
  localStreamRef: PropTypes.shape({
    current: PropTypes.instanceOf(MediaStream),
  }),
  remoteStreamsRef: PropTypes.shape({
    current: PropTypes.instanceOf(Map), // Map<userId, MediaStream>
  }),
  streamsVersion: PropTypes.number, // Increments when streams are added/removed
  joinCall: PropTypes.func.isRequired,
  cleanupLocalCall: PropTypes.func.isRequired,
  startScreenShare: PropTypes.func.isRequired,
  stopScreenShare: PropTypes.func.isRequired,
};

export default CallModal;
