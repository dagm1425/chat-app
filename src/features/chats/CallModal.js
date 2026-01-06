import PropTypes from "prop-types";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
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
import { useSelector } from "react-redux";
import { selectCall } from "./chatsSlice";
import { v4 as uuid } from "uuid";
import { useEffect, useState, useRef } from "react";
import { selectUser } from "../user/userSlice";

const CallModal = ({
  peerConnectionRef,
  localStreamRef,
  remoteStreamRef,
  joinCall,
  cleanupLocalCall,
  startScreenShare,
  stopScreenShare,
}) => {
  const callState = useSelector(selectCall);
  const user = useSelector(selectUser);
  const callData = callState.callData;
  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false);
  // const timeoutRef = useRef(null);
  const modalRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [timer, setTimer] = useState(0);
  const dragging = useRef(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  // const timeoutStatusMsg = useRef(null);
  const isCleaningUpRef = useRef(false);
  const isMobile = useMediaQuery("(max-width:600px)");
  const isOngoingCall = callState.status === "Ongoing call";

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    if (localAudioRef.current && localStreamRef.current) {
      localAudioRef.current.srcObject = localStreamRef.current;
    }
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
    if (localAudioRef.current && localStreamRef.current) {
      localAudioRef.current.srcObject = localStreamRef.current;
    }
    if (remoteAudioRef.current && remoteStreamRef.current) {
      remoteAudioRef.current.srcObject = remoteStreamRef.current;
    }
  }, [localStreamRef.current, remoteStreamRef.current]);

  useEffect(() => {
    if (!callData?.chatId) return;

    const chatRef = doc(db, "chats", callData.chatId);

    const unsubscribe = onSnapshot(chatRef, (docSnap) => {
      if (!docSnap.exists()) return;

      const callDataFromFirestore = docSnap.data().call;

      if (callDataFromFirestore) {
        const screenSharingUids = callDataFromFirestore.screenSharingUids || {};

        const localUid = user.uid;
        const remoteUid =
          localUid === callData.caller.uid
            ? callData.callee.uid
            : callData.caller.uid;

        const remoteIsSharing = !!screenSharingUids[remoteUid];
        setIsRemoteScreenSharing(remoteIsSharing);
      }

      if (
        !isCleaningUpRef.current &&
        callDataFromFirestore?.isActive === false &&
        callState.isActive === true
      ) {
        if (localVideoRef.current?.srcObject)
          localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current?.srcObject)
          remoteVideoRef.current.srcObject = null;
        handleLocalCallCleanup();
      }
    });

    return () => unsubscribe();
  }, [callData?.chatId]);

  useEffect(() => {
    if (!peerConnectionRef.current) return;

    let disconnectTimeout;

    const handleConnectionChange = () => {
      const state = peerConnectionRef.current.connectionState;

      if (state === "disconnected") {
        // Debounce short network hiccups (3 seconds)
        disconnectTimeout = setTimeout(() => {
          hangUp();
        }, 3000);
      } else if (state === "failed") {
        // Cannot recover → hang up immediately
        hangUp();
      } else {
        // Connection restored or ongoing
        clearTimeout(disconnectTimeout);
      }
    };

    peerConnectionRef.current.addEventListener(
      "connectionstatechange",
      handleConnectionChange
    );

    return () => {
      clearTimeout(disconnectTimeout);
      peerConnectionRef.current.removeEventListener(
        "connectionstatechange",
        handleConnectionChange
      );
    };
  }, [peerConnectionRef.current]);

  useEffect(() => {
    if (!callData?.chatId) return;

    const chatRef = doc(db, "chats", callData.chatId);
    let intervalId = null;

    const unsubscribe = onSnapshot(chatRef, (snapshot) => {
      const data = snapshot.data().call;
      const startTime = data?.callData?.startTime?.toDate();

      if (startTime && !intervalId) {
        intervalId = setInterval(() => {
          const elapsedMs = new Date() - startTime;
          const elapsedSeconds = Math.floor(elapsedMs / 1000);
          setTimer(elapsedSeconds);
        }, 1000);
      }
    });

    return () => {
      unsubscribe();
      if (intervalId) clearInterval(intervalId);
    };
  }, [callData?.chatId]);

  const getCallStatusText = () => {
    if (user.uid === callData.callee.uid) {
      return callState.status === "" ? "Incoming call" : callState.status;
    }
    return callState.status;
  };

  const formatCallDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const sendMsg = async (status) => {
    const msgId = uuid();
    const msgRef = doc(db, "chats", callData.chatId, "chatMessages", msgId);
    const chatRef = doc(db, "chats", callData.chatId);
    const chatSnap = await getDoc(chatRef);
    const chatData = chatSnap.data();
    let unreadCounts = { ...chatData.unreadCounts };

    const newMsg = {
      msgId,
      type: "call",
      callData: {
        status,
        duration: formatCallDuration(timer),
        isVideoCall: callData.isVideoCall,
        chat: {
          chatId: chatData.chatId,
          members: chatData.members,
        },
      },
      from: callData.caller,
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

  const handleLocalCallCleanup = () => {
    if (localAudioRef.current) localAudioRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;

    cleanupLocalCall();
    isCleaningUpRef.current = false;
  };

  const getCallStatus = (userForStatus, timer) => {
    const isCaller = userForStatus.uid === callData.caller.uid;
    const isCallee = userForStatus.uid === callData.callee.uid;
    const didCallerHangUp = user.uid === callData.caller.uid;

    if (timer > 0) {
      return isCaller ? "Outgoing call" : "Incoming call";
    }

    if (isCaller) return didCallerHangUp ? "Cancelled call" : "Declined call";
    if (isCallee) return didCallerHangUp ? "Missed call" : "Declined call";
  };

  const hangUp = async () => {
    if (localVideoRef.current?.srcObject)
      localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current?.srcObject)
      remoteVideoRef.current.srcObject = null;

    isCleaningUpRef.current = true;

    const chatRef = doc(db, "chats", callData.chatId);

    await updateDoc(chatRef, {
      call: {
        isActive: false,
        callData: {},
      },
    });

    const status = {
      [callData.caller.uid]: getCallStatus({ uid: callData.caller.uid }, timer),
      [callData.callee.uid]: getCallStatus({ uid: callData.callee.uid }, timer),
    };
    sendMsg(status);
    handleLocalCallCleanup();

    if (callData.roomId) {
      const roomRef = doc(collection(chatRef, "rooms"), callData.roomId);
      const calleeCandidates = await getDocs(
        collection(roomRef, "calleeCandidates")
      );
      await Promise.all(calleeCandidates.docs.map((c) => deleteDoc(c.ref)));

      const callerCandidates = await getDocs(
        collection(roomRef, "callerCandidates")
      );
      await Promise.all(callerCandidates.docs.map((c) => deleteDoc(c.ref)));

      await deleteDoc(roomRef);
    }

    // if (timeoutStatusMsg.current) timeoutStatusMsg.current = null;
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
          visibility: isRemoteScreenSharing ? "hidden" : "visible",
        }}
      >
        <Avatar
          src={callData.callee.photoURL}
          sx={{ width: 75, height: 75, mb: 1 }}
        />
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="h3" fontSize="1.625rem" color="#fff">
            {user.uid === callData.callee.uid
              ? callData.caller.displayName.split(" ")[0]
              : callData.callee.displayName.split(" ")[0]}
          </Typography>
          <Typography variant="subtitle1" fontWeight="normal" color="#d6d6c2">
            {getCallStatusText()}
          </Typography>
        </Box>
        <Typography
          variant="body2"
          sx={{
            color: "#d6d6c2",
            visibility: isOngoingCall ? "visible" : "hidden",
          }}
        >
          {formatCallDuration(timer)}
        </Typography>
      </Box>
      {callData.isVideoCall ? (
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
              {user.uid === callData.callee.uid
                ? callData.caller.displayName.split(" ")[0]
                : callData.callee.displayName.split(" ")[0]}
            </span>
            <span> | </span>
            <span>{isOngoingCall && formatCallDuration(timer)}</span>
          </Box>
          <video
            style={{
              position: "absolute",
              left: "50%",
              top: 250,
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
              zIndex: 2,
              marginBottom: isOngoingCall ? "0" : ".625rem",
            }}
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
          />
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
            ref={remoteVideoRef}
            autoPlay
            playsInline
          />
        </>
      ) : (
        <>
          <audio ref={localAudioRef} autoPlay muted />
          <audio ref={remoteAudioRef} autoPlay />
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
        {user.uid === callData.callee.uid && callState?.status === "" && (
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
              display:
                user.uid === callData.callee.uid && !isOngoingCall
                  ? "none"
                  : "flex",
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
            display:
              user.uid === callData.callee.uid && !isOngoingCall
                ? "none"
                : "flex",
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
  peerConnectionRef: PropTypes.shape({
    current: PropTypes.instanceOf(RTCPeerConnection),
  }),
  localStreamRef: PropTypes.shape({
    current: PropTypes.instanceOf(MediaStream),
  }),
  remoteStreamRef: PropTypes.shape({
    current: PropTypes.instanceOf(MediaStream),
  }),
  joinCall: PropTypes.func,
  cleanupLocalCall: PropTypes.func,
  startScreenShare: PropTypes.func,
  stopScreenShare: PropTypes.func,
};

export default CallModal;
