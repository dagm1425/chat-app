import { useRef, useState, useCallback } from "react";
import {
  onSnapshot,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  deleteField,
  query,
  where,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import { v4 as uuid } from "uuid";
import { useDispatch, useSelector } from "react-redux";
import { selectCall, setCall } from "../chatsSlice";
import { selectUser } from "../../user/userSlice";

const useWebRTC = (db) => {
  const dispatch = useDispatch();
  const callState = useSelector(selectCall);
  const user = useSelector(selectUser);

  // Maps to store connections and streams for each participant
  // Key: userId, Value: RTCPeerConnection / MediaStream
  const peerConnectionsRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());
  const localStreamRef = useRef(null);

  // Store unsubscribe functions for Firestore listeners
  const unsubscribeSignalsRef = useRef(null);
  const unsubscribeParticipantsRef = useRef(null);

  // Track stream changes to notify CallModal when streams are added/removed
  // This is more efficient than polling - only triggers re-renders when streams actually change
  const [streamsVersion, setStreamsVersion] = useState(0);
  const forceRender = useCallback(() => {
    setStreamsVersion((v) => v + 1);
  }, []);

  const configuration = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
    ],
  };
  const checkIfCalleeIsBusy = async (calleeUid) => {
    const calleeDoc = await getDoc(doc(db, "users", calleeUid));
    const calleeData = calleeDoc.data();

    return calleeData.isUserLineBusy;
  };

  const updateCallStartTime = async (chat) => {
    const chatRef = doc(db, "chats", chat.chatId);

    if (!callState.callData.startTime) {
      await updateDoc(chatRef, {
        "call.callData.startTime": serverTimestamp(),
      });
    }
  };

  const updateStartCallStates = (localStream, remoteStream, peerConnection) => {
    localStreamRef.current = localStream;
    remoteStreamRef.current = remoteStream;
    peerConnectionRef.current = peerConnection;
  };

  const makeCall = async (chat, isAudioCall) => {
    const otherChatMember = chat.members.find(
      (member) => member.uid !== user.uid
    );
    const partialCallData = {
      caller: user,
      callee: otherChatMember,
      isVideoCall: !isAudioCall,
    };
    const call = {
      isActive: true,
      callData: partialCallData,
      status: "Calling...",
    };

    dispatch(setCall(call));

    const isCalleeBusy = await checkIfCalleeIsBusy(otherChatMember.uid);

    if (isCalleeBusy) {
      dispatch(setCall({ ...call, status: "Line is busy" }));
      setTimeout(() => {
        dispatch(setCall({ isActive: false, callData: {}, status: "" }));
      }, 2500);
      return;
    }

    const peerConnection = new RTCPeerConnection(configuration);

    const localStream = await navigator.mediaDevices.getUserMedia({
      video: !isAudioCall,
      audio: true,
    });
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    const remoteStream = new MediaStream();

    const offer = await peerConnection.createOffer();

    const roomWithOffer = {
      offer: {
        type: offer.type,
        sdp: offer.sdp,
      },
    };

    const chatRef = doc(db, "chats", chat.chatId);

    const roomsCollectionRef = collection(chatRef, "rooms");

    const roomRef = await addDoc(roomsCollectionRef, roomWithOffer);

    const candidatesCollection = collection(roomRef, "callerCandidates");

    peerConnection.addEventListener("icecandidate", async (event) => {
      if (event.candidate) {
        await addDoc(candidatesCollection, event.candidate.toJSON());
      }
    });

    await peerConnection.setLocalDescription(offer);

    updateStartCallStates(localStream, remoteStream, peerConnection);

      const callData = {
        id: callId,
        participants: [user.uid], // Only I am active initially
        participantDetails,
        initiator: user.uid,
        isVideoCall, // Only store isVideoCall, derive isAudioCall as !isVideoCall
        isGroupCall,
        chatId: chat.chatId,
      };

      // 4. Update Redux State (Optimistic update to prevent App.js listener from overriding status)
      dispatch(
        setCall({
          isActive: true,
          status: "Calling...",
          callData: callData,
        })
      );

      // 5. Update Chat Document (single source of truth)
      const chatRef = doc(db, "chats", chat.chatId);
      await updateDoc(chatRef, {
        "call.isActive": true,
        "call.status": "Calling...",
        "call.callData": callData,
      });

      // 6. Subscribe to signaling
      console.log(
        `[L162] Setting up signal subscriptions for chatId: ${chat.chatId}`
      );
      subscribeToSignals(chat.chatId);
      subscribeToParticipants(chat.chatId, localStream);
      console.log(`[L163] startCall completed successfully`);
    } catch (error) {
      console.error("[L165] Error starting call:", error);
      dispatch(
        setCall({
          isActive: false,
          status: "Error starting call",
          callData: {},
        })
      );
    }
  };

  // eslint-disable-next-line no-unused-vars
  const subscribeToParticipants = (chatId, localStream) => {
    const chatRef = doc(db, "chats", chatId);

    // Unsubscribe from previous listener if exists
    if (unsubscribeParticipantsRef.current) {
      unsubscribeParticipantsRef.current();
    }

    // Listen for participant changes in chat.call.callData
    const unsubscribe = onSnapshot(chatRef, async (snapshot) => {
      const data = snapshot.data();
      if (!peerConnection.currentRemoteDescription && data?.answer) {
        const answer = new RTCSessionDescription(data.answer);
        await peerConnection.setRemoteDescription(answer);
      }
    });

    peerConnection.addEventListener("track", (event) => {
      event.streams[0].getTracks().forEach(async (track) => {
        remoteStream.addTrack(track);
        updateCallStartTime(chat);
      });
    });

    unsubscribeParticipantsRef.current = unsubscribe;
    return unsubscribe;
  };

  const initiateConnectionsToExistingParticipants = async (
    chatId,
    localStream
  ) => {
    // Called when I join. I am the "new" one.
    console.log(
      `[L210] initiateConnectionsToExistingParticipants called for chatId: ${chatId}`
    );
    const chatRef = doc(db, "chats", chatId);
    const snap = await getDoc(chatRef);
    const callData = snap.data()?.call?.callData;
    if (!callData) {
      console.log(`[L218] No callData found, returning`);
      return;
    }

    const participants = callData.participants || [];
    console.log(
      `[L221] Existing participants: ${JSON.stringify(participants)}`
    );

    for (const pUid of participants) {
      if (pUid === user.uid) {
        console.log(`[L223] Skipping self (${pUid})`);
        continue;
      }

      console.log(`[L226] Creating PC and sending offer to ${pUid}`);
      // Create PC
      const pc = await createPeerConnection(pUid, chatId, localStream);
      console.log(
        `[L228] PC created, current signalingState: ${pc.signalingState}`
      );

      // Create Offer
      console.log(`[L229] Creating offer for ${pUid}`);
      const offer = await pc.createOffer();
      console.log(
        `[L230] Offer created, type: ${offer.type}, setting local description. Current signalingState: ${pc.signalingState}`
      );
      await pc.setLocalDescription(offer);
      console.log(
        `[L230] Local description set. New signalingState: ${pc.signalingState}, connectionState: ${pc.connectionState}`
      );

      // Send Offer
      console.log(`[L233] Sending offer to Firestore for ${pUid}`);
      const signalsRef = collection(db, "chats", chatId, "signals");
      await addDoc(signalsRef, {
        type: "offer",
        from: user.uid,
        to: pUid,
        payload: { type: offer.type, sdp: offer.sdp },
      });
      console.log(`[L239] Offer sent to Firestore for ${pUid}`);
    }
    console.log(
      `[L241] Finished initiating connections to existing participants`
    );
  };

  const subscribeToSignals = (chatId) => {
    console.log(`[L243] subscribeToSignals called for chatId: ${chatId}`);
    const signalsRef = collection(db, "chats", chatId, "signals");
    const q = query(signalsRef, where("to", "==", user.uid));

    // Unsubscribe from previous listener if exists
    if (unsubscribeSignalsRef.current) {
      console.log(`[L248] Unsubscribing from previous signals listener`);
      unsubscribeSignalsRef.current();
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      console.log(
        `[L252] onSnapshot fired, docChanges count: ${
          snapshot.docChanges().length
        }`
      );
      // Process signals sequentially to avoid race conditions
      // (e.g., ICE candidate processed before offer/answer)
      for (const change of snapshot.docChanges()) {
        if (change.type === "added") {
          const data = change.doc.data();
          const senderUid = data.from;
          const { type, payload } = data;
          console.log(
            `[L256] Processing ${change.type} signal: type=${type}, from=${senderUid}, docId=${change.doc.id}`
          );

          // Process signal
          let pc = peerConnectionsRef.current.get(senderUid);
          console.log(
            `[L262] PC lookup for ${senderUid}: ${pc ? "EXISTS" : "NOT FOUND"}`
          );

          if (!pc && type === "offer") {
            // We received an offer from someone we don't have a PC with yet.
            // We are the ANSWERER.
            console.log(
              `[L264] No PC exists for offer from ${senderUid}, creating new PC (we are ANSWERER)`
            );
            pc = await createPeerConnection(
              senderUid,
              chatId,
              localStreamRef.current
            );
            console.log(
              `[L271] PC created, signalingState: ${pc.signalingState}`
            );
          }

          if (!pc) {
            console.log(`[L274] No PC available, skipping signal processing`);
            continue;
          }

          console.log(
            `[L276] Processing ${type} signal. PC signalingState: ${pc.signalingState}, connectionState: ${pc.connectionState}`
          );

          if (type === "offer") {
            console.log(`[L277] Handling OFFER from ${senderUid}`);
            const remoteDesc = new RTCSessionDescription(payload);
            console.log(
              `[L278] Setting remote description (offer). Current signalingState: ${pc.signalingState}`
            );
            await pc.setRemoteDescription(remoteDesc);
            console.log(
              `[L278] Remote description (offer) set. New signalingState: ${pc.signalingState}`
            );

            console.log(`[L280] Creating answer`);
            const answer = await pc.createAnswer();
            console.log(
              `[L281] Answer created, setting local description. Current signalingState: ${pc.signalingState}`
            );
            await pc.setLocalDescription(answer);
            console.log(
              `[L281] Local description (answer) set. New signalingState: ${pc.signalingState}`
            );

            // Send Answer
            console.log(`[L284] Sending answer to Firestore for ${senderUid}`);
            await addDoc(signalsRef, {
              type: "answer",
              from: user.uid,
              to: senderUid,
              payload: { type: answer.type, sdp: answer.sdp },
            });
            console.log(`[L289] Answer sent to Firestore for ${senderUid}`);
          } else if (type === "answer") {
            // We are the OFFERER receiving answer
            console.log(
              `[L290] Handling ANSWER from ${senderUid}. Current signalingState: ${pc.signalingState}`
            );
            const remoteDesc = new RTCSessionDescription(payload);
            console.log(
              `[L293] Setting remote description (answer). Current signalingState: ${pc.signalingState}, connectionState: ${pc.connectionState}`
            );
            try {
              await pc.setRemoteDescription(remoteDesc);
              console.log(
                `[L293] Remote description (answer) set successfully. New signalingState: ${pc.signalingState}`
              );
            } catch (error) {
              console.error(
                `[L293] ERROR setting remote description (answer):`,
                error
              );
              console.error(
                `[L293] PC state at error - signalingState: ${pc.signalingState}, connectionState: ${pc.connectionState}, localDescription: ${pc.localDescription?.type}, remoteDescription: ${pc.remoteDescription?.type}`
              );
              throw error;
            }
          } else if (type === "candidate") {
            console.log(`[L295] Handling ICE CANDIDATE from ${senderUid}`);
            const candidate = new RTCIceCandidate(payload);
            console.log(
              `[L296] Adding ICE candidate. Current signalingState: ${pc.signalingState}`
            );
            try {
              await pc.addIceCandidate(candidate);
              console.log(`[L296] ICE candidate added successfully`);
            } catch (error) {
              // Ignore if remote description not set - new candidates will be generated
              if (error.message.includes("remote description")) {
                console.log(
                  `[L296] Skipping candidate - remote description not ready yet`
                );
              } else {
                console.error(`[L296] Error adding ICE candidate:`, error);
              }
            }
          }
        }
      }
      console.log(`[L300] Finished processing all docChanges`);
    });

    unsubscribeSignalsRef.current = unsubscribe;
    return unsubscribe;
  };

  const joinCall = async () => {
    // Get chatId from Redux state (populated by App.js from Firestore)
    console.log(`[L306] joinCall called`);
    const chatId = callState.callData?.chatId;

    if (!chatId) {
      console.error("[L310] joinCall: Missing chatId in callState");
      return;
    }

    try {
      console.log(
        `[L316] Getting call data from Firestore for chatId: ${chatId}`
      );
      // Get call data from chat document
      const chatRef = doc(db, "chats", chatId);
      const chatSnapshot = await getDoc(chatRef);
      if (!chatSnapshot.exists()) {
        console.log(`[L319] Chat document does not exist`);
        return;
      }

      const callData = chatSnapshot.data()?.call?.callData;
      if (!callData) {
        console.log(`[L321] No callData found`);
        return;
      }

      const isVideoCall = callData.isVideoCall || false;
      console.log(`[L324] Call type: ${isVideoCall ? "VIDEO" : "AUDIO"}`);

      // Get stream based on call type
      console.log(
        `[L327] Requesting user media: video=${isVideoCall}, audio=true`
      );
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: isVideoCall,
        audio: true,
      });
      remoteStream = new MediaStream();

      peerConnection = new RTCPeerConnection(configuration);

      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });

      updateJoinCallStates(peerConnection, localStream, remoteStream);

      const candidatesCollection = collection(roomRef, "calleeCandidates");

      peerConnection.addEventListener("icecandidate", async (event) => {
        if (event.candidate) {
          await addDoc(candidatesCollection, event.candidate.toJSON());
        }
      });

      peerConnection.addEventListener("track", (event) => {
        event.streams[0].getTracks().forEach((track) => {
          remoteStream.addTrack(track);
        });
      });

      const offer = roomSnapshot.data().offer;
      await peerConnection.setRemoteDescription(offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      const roomWithAnswer = {
        answer: {
          type: answer.type,
          sdp: answer.sdp,
        },
      };

      await updateDoc(roomRef, roomWithAnswer);

      onSnapshot(roomRef, async (snapshot) => {
        const data = snapshot.data();
        if (!peerConnection.currentRemoteDescription && data?.answer) {
          const answer = new RTCSessionDescription(data.answer);
          await peerConnection.setRemoteDescription(answer);
        }
      });
    }
  }

  const cleanupLocalCall = () => {
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
      remoteStreamsRef.current.clear();
      console.log("[useWebRTC] All remote streams stopped and cleared");

      // IMMEDIATE UI UPDATE: Clear Redux state now to close modal immediately
      console.log(
        "[useWebRTC] Clearing Redux state to close modal (isActive: false)"
      );
      dispatch(setCall({ isActive: false, callData: {}, status: "" }));
    }, 900);
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const screenTrack = screenStream.getVideoTracks()[0];

      // Replace video track in ALL peer connections
      peerConnectionsRef.current.forEach((pc) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(
          (s) => s.track && s.track.kind === "video"
        );
        if (videoSender) videoSender.replaceTrack(screenTrack);
      });

      // Update local stream ref for preview
      const audioTracks = localStreamRef.current.getAudioTracks();
      const audioTrack = audioTracks.length > 0 ? audioTracks[0] : null;
      const newStream = new MediaStream([screenTrack]);
      if (audioTrack) newStream.addTrack(audioTrack);

      localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
      localStreamRef.current = newStream;
      forceRender();

      // Update Firestore to notify others
      if (callState.callData?.chatId) {
        const chatRef = doc(db, "chats", callState.callData.chatId);
        await updateDoc(chatRef, {
          [`call.screenSharingUids.${user.uid}`]: true,
        });
      }

      screenTrack.onended = () => stopScreenShare();

      return newStream;
    } catch (e) {
      console.error("Error sharing screen", e);
      return null;
    }
  };

  const stopScreenShare = async () => {
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      const cameraTrack = cameraStream.getVideoTracks()[0];

      peerConnectionsRef.current.forEach((pc) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(
          (s) => s.track && s.track.kind === "video"
        );
        if (videoSender) videoSender.replaceTrack(cameraTrack);
      });

      // Stop old screen track before replacing
      localStreamRef.current.getVideoTracks().forEach((t) => t.stop());

      const audioTracks = localStreamRef.current.getAudioTracks();
      const audioTrack = audioTracks.length > 0 ? audioTracks[0] : null;
      const newStream = new MediaStream([cameraTrack]);
      if (audioTrack) newStream.addTrack(audioTrack);

      localStreamRef.current = newStream;
      forceRender();

      // Update Firestore
      if (callState.callData?.chatId) {
        const chatRef = doc(db, "chats", callState.callData.chatId);
        await updateDoc(chatRef, {
          [`call.screenSharingUids.${user.uid}`]: deleteField(),
        });
      }

      return newStream;
    } catch (e) {
      console.error("Error stopping screen share", e);
      return null;
    }
  };

  return {
    localStreamRef,
    remoteStreamsRef, // Map<userId, MediaStream>
    peerConnectionsRef, // Map<userId, RTCPeerConnection>
    streamsVersion, // Increments when streams are added/removed - use as dependency in CallModal
    startCall,
    joinCall,
    cleanupLocalCall,
    startScreenShare,
    stopScreenShare,
  };
};

export default useWebRTC;
