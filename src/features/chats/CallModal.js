/* eslint-disable no-unused-vars */
import PropTypes from "prop-types";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
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
  StopScreenShare,
} from "@mui/icons-material";
import { useDispatch, useSelector } from "react-redux";
import { selectCall, setCall, selectChatById } from "./chatsSlice";
import { v4 as uuid } from "uuid";
import { useEffect, useState, useRef, memo } from "react";
import { selectUser } from "../user/userSlice";

const CallDurationBase = ({ startTime, visible, formatCallDuration }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

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

CallDurationBase.propTypes = {
  startTime: PropTypes.instanceOf(Date),
  visible: PropTypes.bool.isRequired,
  formatCallDuration: PropTypes.func.isRequired,
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
  // For group calls: Map of userId -> video element ref
  const remoteVideoRefsMap = useRef(new Map());
  // const timeoutStatusMsg = useRef(null);
  const isCleaningUpRef = useRef(false);
  const isMobile = useMediaQuery("(max-width:600px)");
  const isOngoingCall = callState.status === "Ongoing call";
  const readyRemoteStreamsArray = remoteStreamsArray.filter(([userId]) =>
    readyRemoteStreamIds.has(userId)
  );

  // DEBUG: Track localVideoRef on every render
  useEffect(() => {
    console.log("[CallModal Debug] callState:", {
      callStatus: callState.status,
      isActive: callState.isActive,
    });
  });

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
    // Safely get participant info from participantDetails
    // Returns null if not found, or participant object with { uid, displayName, photoURL }
    if (!uid || !callData?.participantDetails) return null;
    return callData.participantDetails[uid] || null;
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

  // Track which streams we've already attached to video elements
  const attachedStreamsRef = useRef(new Set());

  useEffect(() => {
    setReadyRemoteStreamIds(new Set());
  }, [callData?.chatId]);

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

  // Update local and remote video/audio elements
  // Attach streams once when they become available - browser handles new tracks automatically
  useEffect(() => {
    // Don't re-attach streams during cleanup (prevents video from reappearing after hangup)
    if (isCleaningUpRef.current) {
      console.log(
        "[CallModal] useEffect: Skipping stream attachment (cleanup in progress)"
      );
      return;
    }

    // Local stream
    if (
      localVideoRef.current &&
      localStreamRef.current &&
      localVideoRef.current.srcObject !== localStreamRef.current
    ) {
      console.log(
        "[CallModal] attaching localVideo srcObject @",
        new Date().toISOString()
      );
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    if (
      localAudioRef.current &&
      localStreamRef.current &&
      localAudioRef.current.srcObject !== localStreamRef.current
    ) {
      console.log(
        "[CallModal] attaching localAudio srcObject @",
        new Date().toISOString()
      );
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
            console.log(
              "[CallModal] attaching group remote video srcObject for user",
              userId,
              "@",
              new Date().toISOString()
            );
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
            console.log(
              "[CallModal] attaching 1:1 remoteVideo srcObject @",
              new Date().toISOString()
            );
            remoteVideoRef.current.srcObject = firstRemoteStream;
          }
          if (
            remoteAudioRef.current &&
            remoteAudioRef.current.srcObject !== firstRemoteStream
          ) {
            console.log(
              "[CallModal] attaching 1:1 remoteAudio srcObject @",
              new Date().toISOString()
            );
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
  ]);

  useEffect(() => {
    if (!callData?.chatId) return;

    const chatRef = doc(db, "chats", callData.chatId);

    const unsubscribe = onSnapshot(chatRef, (docSnap) => {
      console.log(
        `[debug speed] [CallModal] Firestore snapshot received @ ${new Date().toISOString()} chatId=${
          callData?.chatId
        }`
      );
      // Don't process updates if we're cleaning up
      if (isCleaningUpRef.current) {
        console.log(
          "[CallModal] Firestore snapshot update ignored (cleanup in progress)"
        );
        return;
      }

      if (!docSnap.exists()) {
        console.log("[CallModal] Firestore snapshot: document does not exist");
        return;
      }

      const callDataFromFirestore = docSnap.data().call;
      console.log("[CallModal] Firestore snapshot update:", {
        hasCallData: !!callDataFromFirestore,
        isActive: callDataFromFirestore?.isActive,
        callStateIsActive: callState.isActive,
        isCleaningUp: isCleaningUpRef.current,
      });
      console.log(
        `[CallModal] snapshot @ ${new Date().toISOString()} remoteStreamsSize=${
          remoteStreamsRef?.current?.size || 0
        } localVideoSrc=${!!localVideoRef.current
          ?.srcObject} remoteVideoSrc=${!!remoteVideoRef.current
          ?.srcObject} callStatus=${callState.status}`
      );

      if (callDataFromFirestore) {
        const startTime =
          callDataFromFirestore?.callData?.startTime?.toDate?.() || null;
        if (startTime && !startTimeRef.current) {
          startTimeRef.current = startTime;
        }
        const screenSharingUidsFromFirestore =
          callDataFromFirestore.screenSharingUids || {};

        // If call ended in Firestore (isActive: false), close modal for remaining participants
        // Works for both 1:1 and group calls
        if (
          !isCleaningUpRef.current &&
          callState.isActive === true &&
          callDataFromFirestore &&
          callDataFromFirestore.isActive === false
        ) {
          console.log(
            `[debug speed] [CallModal] remote hangup detected @ ${new Date().toISOString()}`
          );
          if (localVideoRef.current?.srcObject)
            localVideoRef.current.srcObject = null;
          if (remoteVideoRef.current?.srcObject)
            remoteVideoRef.current.srcObject = null;
          console.log(
            "[CallModal] Detected remote participant left in 1:1 call, ending call",
            `@ ${new Date().toISOString()}`
          );

          // Set cleanup flag FIRST to prevent media `onPlaying` handlers
          // from re-setting the call status to "Ongoing call".
          console.log(
            "[CallModal] setting isCleaningUpRef.current = true @",
            new Date().toISOString()
          );
          isCleaningUpRef.current = true;

          // Show "Call ended" status to user
          console.log(
            "[CallModal] dispatching Call ended @",
            new Date().toISOString(),
            "previousStatus=",
            callState.status
          );
          dispatch(setCall({ ...callState, status: "Call ended" }));

          // Clear video elements immediately to stop any further playback events
          console.log(
            "[CallModal] clearing video srcObjects @",
            new Date().toISOString(),
            {
              localVideoSrc: !!localVideoRef.current?.srcObject,
              remoteVideoSrc: !!remoteVideoRef.current?.srcObject,
            }
          );

          // Run cleanup immediately (match local hangup behavior)
          console.log(
            "[CallModal] calling handleLocalCallCleanup() immediately @",
            new Date().toISOString()
          );
          handleLocalCallCleanup();
          // setTimeout(() => {
          // }, 1000);

          return; // Don't process further updates
        }

        // Only update state if not cleaning up (prevents jittering)
        if (!isCleaningUpRef.current) {
          console.log("[CallModal] Updating screenSharingUids state");
          console.log(
            "[CallModal] screenSharingUidsFromFirestore",
            screenSharingUidsFromFirestore
          );
          setScreenSharingUids(screenSharingUidsFromFirestore);

          // For 1:1 calls: Check if remote is sharing
          if (!callData?.isGroupCall) {
            const otherParticipants = getOtherParticipants();
            if (otherParticipants.length > 0) {
              const remoteUid = otherParticipants[0];
              const remoteIsSharing =
                !!screenSharingUidsFromFirestore[remoteUid];
              console.log(
                `[CallModal] Setting isRemoteScreenSharing: ${remoteIsSharing}`
              );
              setIsRemoteScreenSharing(remoteIsSharing);
            }
          }
        } else {
          console.log(
            "[CallModal] Skipping state updates (cleanup in progress)"
          );
        }
      }
    });

    return () => {
      console.log("[CallModal] Cleaning up Firestore listener");
      unsubscribe();
    };
  }, [callData?.chatId]);

  // useEffect(() => {
  //   if (!callData?.chatId) return;

  //   const chatRef = doc(db, "chats", callData.chatId);

  //   const unsubscribe = onSnapshot(chatRef, (docSnap) => {
  //     const callDataFromFirestore = docSnap.data().call;

  //     if (callDataFromFirestore) {
  //       const isGroupCall = callData?.isGroupCall || false;

  //       if (
  //         !isGroupCall &&
  //         !isCleaningUpRef.current &&
  //         callState.isActive === true &&
  //         callDataFromFirestore.isActive === false
  //       ) {
  //         if (localVideoRef.current?.srcObject)
  //           localVideoRef.current.srcObject = null;
  //         if (remoteVideoRef.current?.srcObject)
  //           remoteVideoRef.current.srcObject = null;

  //         isCleaningUpRef.current = true;

  //         dispatch(setCall({ ...callState, status: "Call ended" }));
  //       }
  //     }
  //   });

  //   return () => {
  //     unsubscribe();
  //   };
  // }, [callData?.chatId]);

  useEffect(() => {
    if (!peerConnectionsRef.current || peerConnectionsRef.current.size === 0)
      return;

    let disconnectTimeouts = new Map();

    // Monitor all peer connections
    const handleConnectionChange = (userId, pc) => {
      const state = pc.connectionState;

      if (state === "disconnected") {
        // Debounce short network hiccups (3 seconds)
        const timeout = setTimeout(() => {
          hangUp();
        }, 3000);
        disconnectTimeouts.set(userId, timeout);
      } else if (state === "failed") {
        // Cannot recover → hang up immediately
        hangUp();
      } else {
        // Connection restored or ongoing
        const timeout = disconnectTimeouts.get(userId);
        if (timeout) {
          clearTimeout(timeout);
          disconnectTimeouts.delete(userId);
        }
      }
    };

    // Add listeners to all existing connections
    const cleanupFunctions = [];
    peerConnectionsRef.current.forEach((pc, userId) => {
      const handler = () => handleConnectionChange(userId, pc);
      pc.addEventListener("connectionstatechange", handler);
      cleanupFunctions.push(() => {
        pc.removeEventListener("connectionstatechange", handler);
      });
    });

    return () => {
      // Clear all timeouts
      disconnectTimeouts.forEach((timeout) => clearTimeout(timeout));
      disconnectTimeouts.clear();
      // Remove all event listeners
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, [peerConnectionsRef]);

  useEffect(() => {
    console.log("localVideoRef.current", localVideoRef.current);
  }, []);

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
    // If user is not the initiator, show "Incoming call" when status is empty
    if (!isInitiator() && callState.status === "") {
      return "Incoming call";
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

  const sendMsg = async (status, durationSeconds) => {
    const msgId = uuid();
    const msgRef = doc(db, "chats", callData.chatId, "chatMessages", msgId);
    const chatRef = doc(db, "chats", callData.chatId);
    const chatSnap = await getDoc(chatRef);
    const chatData = chatSnap.data();
    let unreadCounts = { ...chatData.unreadCounts };

    // Get initiator info for the "from" field
    const initiatorInfo = getParticipantInfo(callData?.initiator) || user;

    const newMsg = {
      msgId,
      type: "call",
      callData: {
        status,
        duration: formatCallDuration(durationSeconds),
        isVideoCall: callData.isVideoCall,
        chat: {
          chatId: chatData.chatId,
          members: chatData.members,
        },
      },
      from: initiatorInfo,
      msgReply: null,
      isMsgRead: false,
      timestamp: serverTimestamp(),
    };
    await setDoc(msgRef, newMsg);
    await updateDoc(chatRef, { recentMsg: newMsg });
    await updateDoc(chatRef, { timestamp: newMsg.timestamp });

    for (const uid in unreadCounts) {
      if (uid !== user.uid) {
        unreadCounts[uid]++;
      }
    }
    await updateDoc(chatRef, { unreadCounts });
  };

  const handleLocalCallCleanup = async () => {
    console.log(
      "[CallModal] handleLocalCallCleanup() called @",
      new Date().toISOString()
    );
    // Note: isCleaningUpRef is set to true by hangUp() before calling this

    console.log("[CallModal] Clearing audio elements");
    if (localAudioRef.current) {
      console.log("[CallModal] Clearing local audio srcObject");
      localAudioRef.current.srcObject = null;
    }
    if (remoteAudioRef.current) {
      console.log("[CallModal] Clearing remote audio srcObject");
      remoteAudioRef.current.srcObject = null;
    }

    console.log("[CallModal] Calling useWebRTC.cleanupLocalCall()");
    console.log(
      "[CallModal] cleanupLocalCall type:",
      typeof cleanupLocalCall,
      "is function:",
      typeof cleanupLocalCall === "function"
    );
    if (typeof cleanupLocalCall !== "function") {
      console.error(
        "[CallModal] ERROR: cleanupLocalCall is not a function!",
        cleanupLocalCall
      );
      isCleaningUpRef.current = false;
      return;
    }

    try {
      console.log(
        "[CallModal] About to await cleanupLocalCall() @",
        new Date().toISOString()
      );
      await cleanupLocalCall();
      console.log(
        "[CallModal] cleanupLocalCall() completed successfully @",
        new Date().toISOString()
      );
    } catch (error) {
      console.error("[CallModal] Error in cleanupLocalCall():", error);
      console.error("[CallModal] Error stack:", error.stack);
    } finally {
      // Only reset after cleanup is completely done
      // This prevents multiple simultaneous cleanup calls
      isCleaningUpRef.current = false;
      console.log("[CallModal] Set isCleaningUpRef.current = false");
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
    console.log("[CallModal] hangUp() called");

    // Set cleanup flag IMMEDIATELY to prevent race conditions
    // (useEffect re-attaching streams, onPlaying resetting status)
    isCleaningUpRef.current = true;

    console.log("[CallModal] Current call state:", {
      isActive: callState.isActive,
      status: callState.status,
      participants: callData?.participants,
      timer: getElapsedSeconds(),
    });

    // Set UI status immediately for user feedback
    console.log("[CallModal] Setting status to 'Call ended'");
    dispatch(setCall({ ...callState, status: "Call ended" }));

    // Clear video elements immediately
    console.log("[CallModal] Clearing video elements");
    if (localVideoRef.current?.srcObject) {
      console.log("[CallModal] Clearing local video srcObject");
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current?.srcObject) {
      console.log("[CallModal] Clearing remote video srcObject");
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
      console.log("[CallModal] Built status object for call history:", status);

      // Send call history message
      console.log("[CallModal] Sending call history message");
      sendMsg(status, durationSeconds)
        .then(() => {
          console.log("[CallModal] Call history message sent successfully");
        })
        .catch((error) => {
          console.error(
            "[CallModal] Error sending call history message:",
            error
          );
        });
    } else {
      console.log(
        "[CallModal] Group call: system history message handled on call end"
      );
    }

    // Let useWebRTC.cleanupLocalCall() handle Firestore updates
    // It will:
    // - Remove self from participants
    // - Clear screenSharingUids
    // - Set isActive = false and clear callData if no participants left
    // - Clean up peer connections and streams
    console.log("[CallModal] Calling handleLocalCallCleanup()");

    handleLocalCallCleanup().catch((error) => {
      console.error(
        "[CallModal] Unhandled error in handleLocalCallCleanup():",
        error
      );
    });
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current
      .getAudioTracks()
      .forEach((track) => (track.enabled = !track.enabled));
    setIsMuted((prev) => !prev);
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenShare();
      setIsScreenSharing(false);
    } else {
      const stream = await startScreenShare();
      if (stream) {
        setIsScreenSharing(true);

        stream.getVideoTracks()[0].onended = async () => {
          await stopScreenShare();
          setIsScreenSharing(false);
        };
      }
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
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          pt: 2,
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
            callState.status !== "Call ended"
              ? "Waiting..."
              : getCallStatusText()}
          </Typography>
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
                  const isReady = readyRemoteStreamIds.has(userId);

                  return (
                    <Box
                      key={userId}
                      sx={{
                        position: isReady ? "relative" : "absolute",
                        top: isReady ? "auto" : 0,
                        left: isReady ? "auto" : 0,
                        width: isReady ? "100%" : "1px",
                        height: isReady ? "100%" : "1px",
                        backgroundColor: "#1a1a1a",
                        borderRadius: "4px",
                        overflow: "hidden",
                        opacity: isReady ? 1 : 0,
                        pointerEvents: isReady ? "auto" : "none",
                      }}
                    >
                      <video
                        ref={(el) => {
                          if (videoRef) videoRef.current = el;
                          // Determine if we need to update srcObject
                          // Only update if element exists, stream exists, AND it's different
                          if (el && stream && el.srcObject !== stream) {
                            console.log(
                              `[CallModal] Setting srcObject for user ${userId} (preventing flicker)`
                            );
                            el.srcObject = stream;
                          }
                        }}
                        autoPlay
                        playsInline
                        onPlaying={() => {
                          console.log(
                            `[CallModal][onPlaying][group] ${new Date().toISOString()} user=${userId} isCleaningUp=${
                              isCleaningUpRef.current
                            } callStatusBefore=${callState.status}`
                          );
                          markRemoteStreamReady(userId);
                          ensureStartTime();
                          if (!isCleaningUpRef.current) {
                            dispatch(
                              setCall({ ...callState, status: "Ongoing call" })
                            );
                          }
                        }}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: isThisUserSharing ? "contain" : "cover",
                        }}
                      />
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
                    </Box>
                  );
                })}
              </Box>

              {/* Audio elements for remote streams */}
              {remoteStreamsArray.map(([userId, stream]) => (
                <audio
                  key={`audio-${userId}`}
                  ref={(el) => {
                    // Only update srcObject if different
                    if (el && stream && el.srcObject !== stream) {
                      console.log(
                        `[CallModal] Setting audio srcObject for user ${userId}`
                      );
                      el.srcObject = stream;
                    }
                  }}
                  autoPlay
                  onPlaying={() => {
                    // Avoid unnecessary dispatches if status is already correct
                    ensureStartTime();
                    if (
                      !isCleaningUpRef.current &&
                      callState.status !== "Ongoing call"
                    ) {
                      console.log(
                        `[CallModal][onPlaying][audio] Setting status to Ongoing call for user=${userId}`
                      );
                      dispatch(
                        setCall({ ...callState, status: "Ongoing call" })
                      );
                    }
                  }}
                />
              ))}
            </>
          )}

          {/* 1:1 Remote Video (Only if NOT Group Call) */}
          {!callData.isGroupCall && (
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
                <span>
                  {getPrimaryRemoteParticipant()?.displayName?.split(" ")[0] ||
                    "Unknown"}
                </span>
                <span> | </span>
                <span>
                  <CallDuration
                    startTime={startTimeRef.current}
                    visible={isOngoingCall}
                    formatCallDuration={formatCallDuration}
                  />
                </span>
              </Box>
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
                  display: isOngoingCall ? "block" : "none",
                  zIndex: 1,
                }}
                onPlaying={() => {
                  console.log(
                    `[CallModal][onPlaying][1:1] ${new Date().toISOString()} isCleaningUp=${
                      isCleaningUpRef.current
                    } localVideoSrc=${!!localVideoRef.current
                      ?.srcObject} remoteVideoSrc=${!!remoteVideoRef.current
                      ?.srcObject} callStatusBefore=${callState.status}`
                  );
                  ensureStartTime();
                  if (!isCleaningUpRef.current) {
                    dispatch(setCall({ ...callState, status: "Ongoing call" }));
                  }
                }}
                ref={remoteVideoRef}
                autoPlay
                playsInline
              />
            </>
          )}

          {/* Local Video - Rendered for BOTH modes (unification) */}
          <video
            style={{
              position: "absolute",
              left: "50%",
              top: 250,
              display: callState.status === "Call ended" ? "none" : "block",
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
              transition: "transform .3s ease-out",
              zIndex: 3, // Higher Z-Index than remote content
              marginBottom: isOngoingCall ? "0" : ".625rem",
            }}
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
          />
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

      <Box
        sx={{
          position: "absolute",
          top: "86%",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 2,
          zIndex: 2,
        }}
      >
        {!isInitiator() && callState?.status === "" && (
          <IconButton
            onClick={joinCall}
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
            }}
            disableRipple
          >
            <Call sx={{ fontSize: "1.5rem" }} />
          </IconButton>
        )}

        {callData.isVideoCall && (
          <IconButton
            onClick={toggleScreenShare}
            disabled={!isOngoingCall}
            sx={{
              width: 48,
              height: 48,
              display: !isInitiator() && !isOngoingCall ? "none" : "flex",
              bgcolor: isScreenSharing ? "#fff" : "rgba(0, 0, 0, 0.3)",
              color: isScreenSharing ? "#20232A" : "#fff",
              opacity: isOngoingCall ? 1 : 0.4,
              boxShadow: "0 0 5px rgba(0, 0, 0, 0.3)",
              "&.Mui-disabled": {
                bgcolor: "rgba(255, 255, 255, 0.08)",
                color: "#fff",
              },
            }}
            disableRipple
          >
            {isScreenSharing ? (
              <StopScreenShare sx={{ fontSize: "1.5rem" }} />
            ) : (
              <ScreenShare sx={{ fontSize: "1.5rem" }} />
            )}
          </IconButton>
        )}

        <IconButton
          onClick={toggleMute}
          sx={{
            width: 48,
            height: 48,
            display: !isInitiator() && !isOngoingCall ? "none" : "flex",
            bgcolor: isMuted
              ? "#fff"
              : callData.isVideoCall && isOngoingCall
              ? "rgba(0, 0, 0, 0.3)"
              : "rgba(255, 255, 255, 0.08)",
            color: isMuted ? "#20232A" : "#fff",
            boxShadow: "0 0 5px rgba(0, 0, 0, 0.3)",
            "&:hover": {
              bgcolor: isMuted
                ? "#fff"
                : callData.isVideoCall && isOngoingCall
                ? "rgba(0, 0, 0, 0.3)"
                : "rgba(255, 255, 255, 0.08)",
            },
            "&.MuiButtonBase-root:hover": {
              bgcolor: isMuted
                ? "#fff"
                : callData.isVideoCall && isOngoingCall
                ? "rgba(0, 0, 0, 0.3)"
                : "rgba(255, 255, 255, 0.08)",
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

        {callState.status !== "Call ended" && (
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
        )}
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
