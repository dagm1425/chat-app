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
import { Avatar, Box, IconButton, Typography } from "@mui/material";
import { Mic, MicOff, CallEnd, Call } from "@mui/icons-material";
import { useSelector, useDispatch } from "react-redux";
import { selectCall, setCall } from "./chatsSlice";
import { v4 as uuid } from "uuid";
import { useEffect, useState, useRef } from "react";
import { selectUser } from "../user/userSlice";

const CallModal = ({
  peerConnectionRef,
  localStreamRef,
  remoteStreamRef,
  joinCall,
}) => {
  const callState = useSelector(selectCall);
  const user = useSelector(selectUser);
  const callData = callState.callData;
  const dispatch = useDispatch();
  const [isMuted, setIsMuted] = useState(false);
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

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
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
    console.log("localstreamref.current in useEffect", localStreamRef.current);
    console.log(
      "remotestreamref.current in useEffect",
      remoteStreamRef.current
    );
  }, [localStreamRef.current, remoteStreamRef.current]);

  useEffect(() => {
    if (!callData?.chatId) return;

    const chatRef = doc(db, "chats", callData.chatId);

    const unsubscribe = onSnapshot(chatRef, (docSnap) => {
      if (!docSnap.exists()) return;

      const callDataFromFirestore = docSnap.data().call;

      if (
        !isCleaningUpRef.current &&
        callDataFromFirestore?.isActive === false &&
        callState.isActive === true
      ) {
        if (localVideoRef.current?.srcObject)
          localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current?.srcObject)
          remoteVideoRef.current.srcObject = null;
        console.log("calling cleanupLocalCall from onSnapshot listener");

        cleanupLocalCall();
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
        // hangUp();
        console.log("connectionState:", state);
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

  // useEffect(() => {
  //   if (callState.status === "Ongoing call") {
  //     const interval = setInterval(() => setTimer((prev) => prev + 1), 1000);
  //     return () => clearInterval(interval);
  //   } else {
  //     setTimer(0);
  //   }
  // }, [callState.status]);

  useEffect(() => {
    if (!callData?.chatId) return;

    const chatRef = doc(db, "chats", callData.chatId);
    let intervalId = null;

    const unsubscribe = onSnapshot(chatRef, (snapshot) => {
      const data = snapshot.data().call;
      const startTime = data?.callData?.startTime?.toDate();

      if (startTime && !intervalId) {
        console.log("setting timer interval");
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
    console.log("running sendMsg");
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
    console.log("Message written to Firestore with msgId:", msgId);

    await updateDoc(chatRef, { recentMsg: newMsg });
    await updateDoc(chatRef, { timestamp: newMsg.timestamp });

    for (const uid in unreadCounts) {
      if (uid !== user.uid) {
        unreadCounts[uid]++;
      }
    }
    await updateDoc(chatRef, { unreadCounts });
  };

  const cleanupLocalCall = () => {
    console.log("cleanupLocalCall is running");

    if (callState.callData.status !== "Call ended") {
      dispatch(setCall({ ...callState, status: "Call ended" }));
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      localStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      remoteStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    if (localAudioRef.current) localAudioRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;

    setTimeout(() => {
      dispatch(setCall({ isActive: false, callData: {}, status: "" }));
    }, 900);

    isCleaningUpRef.current = false;
  };

  // const callerStatus = () => {
  //   if (timer === 0 && user.uid === callData.caller.uid) {
  //     return "Cancelled call";
  //   } else if (timer === 0 && user.uid !== callData.caller.uid) {
  //     return "Call rejected";
  //   } else if (timer !== 0) {
  //     return `Outgoing call - ${String(Math.floor(timer / 60)).padStart(
  //       2,
  //       "0"
  //     )}:${String(timer % 60).padStart(2, "0")}`;
  //   }
  // };

  // const calleeStatus = () => {
  //   if (timer === 0 && user.uid !== callData.callee.uid) {
  //     return "Missed call";
  //   } else if (timer === 0 && user.uid === callData.callee.uid) {
  //     return "Call rejected";
  //   } else if (timer !== 0) {
  //     return `Incoming call - ${String(Math.floor(timer / 60)).padStart(
  //       2,
  //       "0"
  //     )}:${String(timer % 60).padStart(2, "0")}`;
  //   }
  // };

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
    console.log("hangUp is running");
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

    // console.log("!timeoutStatusMsg.current", !timeoutStatusMsg.current);

    // const status = timeoutStatusMsg.current
    //   ? timeoutStatusMsg.current
    //   : {
    //       [callData.caller.uid]: getCallStatus(
    //         { uid: callData.caller.uid },
    //         timer
    //       ),
    //       [callData.callee.uid]: getCallStatus(
    //         { uid: callData.callee.uid },
    //         timer
    //       ),
    //     };
    const status = {
      [callData.caller.uid]: getCallStatus({ uid: callData.caller.uid }, timer),
      [callData.callee.uid]: getCallStatus({ uid: callData.callee.uid }, timer),
    };
    sendMsg(status);
    console.log("calling cleanupLocalCall from hangUp");

    cleanupLocalCall();

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
        width: 500,
        height: 490,
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
      <Avatar src={callData.callee.photoURL} sx={{ width: 75, height: 75 }} />
      <Box sx={{ textAlign: "center" }}>
        <Typography variant="h3" fontSize="1.625rem" color="#fff">
          {user.uid === callData.callee.uid
            ? callData.caller.displayName
            : callData.callee.displayName}
        </Typography>
        <Typography variant="subtitle1" fontWeight="normal" color="#d6d6c2">
          {getCallStatusText()}
        </Typography>
      </Box>
      <Typography
        variant="body2"
        sx={{
          color: "#d6d6c2",
          visibility:
            remoteVideoRef.current?.srcObject !== null ? "visible" : "hidden",
        }}
      >
        {formatCallDuration(timer)}
      </Typography>

      {callData.isVideoCall ? (
        <>
          <Box
            sx={{
              position: "absolute",
              top: "25px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "20%",
              bgcolor: "rgba(0, 0, 0, 0.4)",
              backdropFilter: "blur(5px)",
              color: "white",
              fontSize: "0.875rem",
              borderRadius: "10px",
              px: 1.5,
              py: 0.5,
              display: callState.status === "Ongoing call" ? "flex" : "none",
              justifyContent: "space-between",
              alignItems: "center",
              zIndex: 2,
            }}
          >
            <span>
              {user.uid === callData.callee.uid
                ? callData.caller.displayName
                : callData.callee.displayName}
            </span>
            <span>|</span>
            <span>{formatCallDuration(timer)}</span>
          </Box>
          <video
            style={{
              position: "absolute",
              left: "50%",
              top: 215,
              width: 245,
              height: 185,
              borderRadius: "10px",
              overflow: "hidden",
              boxShadow:
                callState.status === "Ongoing call"
                  ? "0 0 5px rgba(0, 0, 0, 0.3)"
                  : "",
              transform:
                callState.status === "Ongoing call"
                  ? "translate(40px, 110px) scale(0.6) scaleX(-1)"
                  : "translateX(-50%) scale(1) scaleX(-1)",
              transition: "transform .3s ease-out",
              zIndex: 2,
              marginBottom:
                callState.status === "Ongoing call" ? "0" : ".625rem",
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
              objectFit: "cover",
              transform: "scaleX(-1)",
              borderRadius: 0,
              display: callState.status === "Ongoing call" ? "block" : "none",
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

        <IconButton
          onClick={toggleMute}
          sx={{
            width: 48,
            height: 48,
            bgcolor: isMuted ? "#fff" : "rgba(255, 255, 255, 0.08)",
            color: isMuted ? "#20232A" : "#fff",
            boxShadow: "0 0 5px rgba(0, 0, 0, 0.3)",

            "&:hover": {
              bgcolor: isMuted ? "#fff" : "rgba(255, 255, 255, 0.08)",
            },
            "&.MuiButtonBase-root:hover": {
              bgcolor: isMuted ? "#fff" : "rgba(255, 255, 255, 0.08)",
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
};

export default CallModal;
