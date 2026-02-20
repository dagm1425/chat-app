import { useRef, useState } from "react";
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
import { store } from "../../../app/store";
import {
  formatDurationMinutes,
  getMediaPermissionMessage,
} from "../../../common/utils";
import { notifyUser } from "../../../common/toast/ToastProvider";

const useWebRTC = (db) => {
  const dispatch = useDispatch();
  const callState = useSelector(selectCall);
  const user = useSelector(selectUser);

  // Maps to store connections and streams for each participant
  // Key: userId, Value: RTCPeerConnection / MediaStream
  const peerConnectionsRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const dummyVideoTrackRef = useRef(null);
  const screenTrackRef = useRef(null);

  // Store unsubscribe functions for Firestore listeners
  const unsubscribeSignalsRef = useRef(null);
  const unsubscribeParticipantsRef = useRef(null);

  // Track stream changes to notify CallModal when streams are added/removed
  // This is more efficient than polling - only triggers re-renders when streams actually change
  const [streamsVersion, setStreamsVersion] = useState(0);
  const forceRender = () => {
    setStreamsVersion((v) => v + 1);
  };

  const configuration = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
    ],
  };

  const normalizeCallDataStartTime = (data) => {
    if (!data) return data;
    const startTime =
      data.startTime && typeof data.startTime.toDate === "function"
        ? data.startTime.toDate().toISOString()
        : data.startTime;
    return { ...data, startTime };
  };

  const createPeerConnection = async (targetUserId, chatId, stream) => {
    if (peerConnectionsRef.current.has(targetUserId)) {
      return peerConnectionsRef.current.get(targetUserId);
    }

    const pc = new RTCPeerConnection(configuration);
    pc.__createdAt = Date.now();
    peerConnectionsRef.current.set(targetUserId, pc);

    // Add local tracks to this new connection
    if (stream) {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        const offerId = pc.__offerId;
        if (!offerId) {
          return;
        }
        const signalsRef = collection(db, "chats", chatId, "signals");
        await addDoc(signalsRef, {
          type: "candidate",
          from: user.uid,
          to: targetUserId,
          offerId,
          payload: event.candidate.toJSON(),
        });
      }
    };

    // Handle incoming tracks
    pc.ontrack = (event) => {
      // Get existing stream or create new one
      let remoteStream = remoteStreamsRef.current.get(targetUserId);
      if (!remoteStream) {
        remoteStream = new MediaStream();
        remoteStreamsRef.current.set(targetUserId, remoteStream);
      }

      // Add tracks that aren't already in the stream
      event.streams[0].getTracks().forEach((track) => {
        const existingTrack = remoteStream
          .getTracks()
          .find((t) => t.id === track.id);
        if (!existingTrack) {
          remoteStream.addTrack(track);
        }
        track.onended = () => {
          if (remoteStream.getTracks().find((t) => t.id === track.id)) {
            remoteStream.removeTrack(track);
            forceRender();
          }
        };
      });

      forceRender(); // Trigger re-render to show new video
    };

    // Handle connection state changes (cleanup if disconnected)
    pc.onconnectionstatechange = () => {
      const mappedPc = peerConnectionsRef.current.get(targetUserId);
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        // Guard against stale callbacks from older RTCPeerConnection instances.
        // Without this, a late event from an old PC can delete the current active
        // connection/stream for the same userId and trigger false "reconnecting" UI.
        if (mappedPc !== pc) {
          return;
        }
        remoteStreamsRef.current.delete(targetUserId);
        peerConnectionsRef.current.delete(targetUserId);
        forceRender();
      }
    };

    return pc;
  };

  const startCall = async (chat, isAudioCall) => {
    // 1. Get Local Stream
    let localStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: !isAudioCall,
        audio: true,
      });
    } catch (error) {
      console.error("[L120] getUserMedia failed:", error);
      notifyUser(getMediaPermissionMessage({ error, isAudioCall }), "info");
      return;
    }

    localStreamRef.current = localStream;

    // 2. Build participantDetails map (uid → user info)
    // Include all chat members so callee info is available immediately
    const participantDetails = {};
    chat.members.forEach((member) => {
      participantDetails[member.uid] = member;
    });

    const isGroupCall = chat.members.length > 2;

    // 3. Create Call Data (stored directly in chat document)
    const callId = uuid(); // Generate ID for reference if needed
    const isVideoCall = !isAudioCall;

    const callData = {
      id: callId,
      participants: [user.uid], // Only I am active initially
      participantDetails,
      initiator: user.uid,
      isVideoCall, // Only store isVideoCall, derive isAudioCall as !isVideoCall
      isGroupCall,
      chatId: chat.chatId,
      ...(isVideoCall ? { videoEnabled: { [user.uid]: true } } : {}),
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
    try {
      await updateDoc(chatRef, {
        "call.isActive": true,
        "call.status": "Calling...",
        "call.callData": callData,
      });
    } catch (error) {
      console.error("[L165] Failed to update call doc:", error);
      localStream.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      dispatch(
        setCall({
          isActive: false,
          status: "",
          callData: {},
        })
      );
      return;
    }

    // 6. Subscribe to signaling
    subscribeToSignals(chat.chatId);
    subscribeToParticipants(chat.chatId, localStream);
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
      if (!data?.call?.callData) return;

      const participants = data.call.callData.participants || [];

      // Cleanup left participants
      const currentPeerIds = Array.from(peerConnectionsRef.current.keys());
      currentPeerIds.forEach((pid) => {
        if (!participants.includes(pid)) {
          // They left
          const pc = peerConnectionsRef.current.get(pid);
          pc.close();
          peerConnectionsRef.current.delete(pid);
          remoteStreamsRef.current.delete(pid);
          forceRender();
        }
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
    const chatRef = doc(db, "chats", chatId);
    const snap = await getDoc(chatRef);
    const callData = snap.data()?.call?.callData;
    if (!callData) {
      return;
    }

    const participants = callData.participants || [];

    for (const pUid of participants) {
      if (pUid === user.uid) {
        continue;
      }

      // Create PC
      const pc = await createPeerConnection(pUid, chatId, localStream);

      // Create Offer
      const offerId = uuid();
      pc.__offerId = offerId;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send Offer
      const signalsRef = collection(db, "chats", chatId, "signals");
      await addDoc(signalsRef, {
        type: "offer",
        from: user.uid,
        to: pUid,
        offerId,
        payload: { type: offer.type, sdp: offer.sdp },
      });
    }
  };

  const subscribeToSignals = (chatId) => {
    const signalsRef = collection(db, "chats", chatId, "signals");
    const q = query(signalsRef, where("to", "==", user.uid));

    // Unsubscribe from previous listener if exists
    if (unsubscribeSignalsRef.current) {
      unsubscribeSignalsRef.current();
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // Process signals sequentially to avoid race conditions
      // (e.g., ICE candidate processed before offer/answer)
      for (const change of snapshot.docChanges()) {
        if (change.type === "added") {
          const data = change.doc.data();
          const senderUid = data.from;
          const { type, payload } = data;
          const consumeSignalDoc = async (reason) => {
            try {
              await deleteDoc(change.doc.ref);
            } catch (error) {
              console.error(
                `[useWebRTC] Failed to delete consumed signal ${change.doc.id} (${reason}):`,
                error
              );
            }
          };

          // Process signal
          let pc = peerConnectionsRef.current.get(senderUid);
          if (!pc && type === "offer") {
            // We received an offer from someone we don't have a PC with yet.
            // We are the ANSWERER.
            pc = await createPeerConnection(
              senderUid,
              chatId,
              localStreamRef.current
            );
          }

          if (!pc) {
            await consumeSignalDoc("no-pc");
            continue;
          }
          if (type === "offer") {
            try {
              const remoteDesc = new RTCSessionDescription(payload);
              const offerId = data.offerId;
              if (!offerId) {
                await consumeSignalDoc("offer-missing-offerid");
                continue;
              }
              // Accept incoming offers only in stable state.
              // Any non-stable state means this PC is already negotiating.
              if (pc.signalingState !== "stable") {
                const reason =
                  pc.signalingState === "have-local-offer"
                    ? "offer-ignored-local-offer-in-flight"
                    : "offer-ignored-non-stable";
                await consumeSignalDoc(reason);
                continue;
              }
              pc.__offerId = offerId;
              await pc.setRemoteDescription(remoteDesc);

              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

              // Send Answer
              await addDoc(signalsRef, {
                type: "answer",
                from: user.uid,
                to: senderUid,
                offerId,
                payload: { type: answer.type, sdp: answer.sdp },
              });
              await consumeSignalDoc("offer-handled");
            } catch (error) {
              console.error(
                `[L277] Error handling OFFER from ${senderUid}:`,
                error
              );
              await consumeSignalDoc("offer-handle-error");
            }
          } else if (type === "answer") {
            // We are the OFFERER receiving answer
            try {
              const offerId = data.offerId;
              if (!offerId || pc.__offerId !== offerId) {
                await consumeSignalDoc("answer-ignored-offerid-mismatch");
                continue;
              }
              // Ignore late/duplicate answers (e.g., after refresh/rejoin).
              if (pc.signalingState !== "have-local-offer") {
                await consumeSignalDoc("answer-ignored-state");
                continue;
              }
              const remoteDesc = new RTCSessionDescription(payload);
              try {
                await pc.setRemoteDescription(remoteDesc);
                await consumeSignalDoc("answer-handled");
              } catch (error) {
                console.error(
                  `[L293] ERROR setting remote description (answer):`,
                  error
                );
                console.error(
                  `[L293] PC state at error - signalingState: ${pc.signalingState}, connectionState: ${pc.connectionState}, localDescription: ${pc.localDescription?.type}, remoteDescription: ${pc.remoteDescription?.type}`
                );
                await consumeSignalDoc("answer-set-remote-error");
              }
            } catch (error) {
              console.error(
                `[L290] Error handling ANSWER from ${senderUid}:`,
                error
              );
              await consumeSignalDoc("answer-handle-error");
            }
          } else if (type === "candidate") {
            try {
              const offerId = data.offerId;
              if (!offerId || pc.__offerId !== offerId) {
                await consumeSignalDoc("candidate-ignored-offerid-mismatch");
                continue;
              }
              const candidate = new RTCIceCandidate(payload);
              await pc.addIceCandidate(candidate);
              await consumeSignalDoc("candidate-handled");
            } catch (error) {
              // Ignore if remote description not set - new candidates will be generated
              if ((error?.message || "").includes("remote description")) {
                await consumeSignalDoc(
                  "candidate-ignored-remote-description-not-ready"
                );
              } else {
                console.error(`[L296] Error adding ICE candidate:`, error);
                await consumeSignalDoc("candidate-add-error");
              }
            }
          } else {
            await consumeSignalDoc("unknown-type");
          }
        }
      }
    });

    unsubscribeSignalsRef.current = unsubscribe;
    return unsubscribe;
  };

  const joinCall = async (previewStream = null, initialVideoEnabled = true) => {
    // Get chatId from Redux state (populated by App.js from Firestore)
    const chatId = callState.callData?.chatId;

    if (!chatId) {
      console.error("[L310] joinCall: Missing chatId in callState");
      return;
    }

    try {
      // Get call data from chat document
      const chatRef = doc(db, "chats", chatId);
      const chatSnapshot = await getDoc(chatRef);
      if (!chatSnapshot.exists()) {
        return;
      }

      const callData = chatSnapshot.data()?.call?.callData;
      if (!callData) {
        return;
      }

      const isVideoCall = callData.isVideoCall || false;
      const shouldClearStaleScreenSharing =
        !!chatSnapshot.data()?.call?.screenSharingUids?.[user.uid];

      // Get stream based on call type (reuse preview stream if available)
      const hasLivePreview =
        previewStream &&
        previewStream.getTracks().some((track) => track.readyState === "live");
      let localStream;
      if (hasLivePreview) {
        localStream = previewStream;
      } else {
        // Fallback: no usable preview (voice call or preview missing after refresh/denied permissions)
        try {
          localStream = await navigator.mediaDevices.getUserMedia({
            video: isVideoCall && initialVideoEnabled,
            audio: true,
          });
        } catch (error) {
          console.error("[L328] joinCall getUserMedia failed:", error);
          notifyUser(
            getMediaPermissionMessage({ error, isAudioCall: !isVideoCall }),
            "info"
          );
          return;
        }
      }
      // dummyTrack is used to keep a video sender/transceiver even when user joins with camera OFF,
      // so later camera/screen-share replaceTrack flows can work reliably
      // without renegotiation. It doesn't trigger onPlaying thus not used to set ongoing call.
      if (
        isVideoCall &&
        !initialVideoEnabled &&
        localStream.getVideoTracks().length === 0
      ) {
        const dummyTrack = getDummyVideoTrack();
        localStream.addTrack(dummyTrack);
      }
      localStreamRef.current = localStream;

      const currentParticipants = callData.participants || [];
      const shouldAddSelfToParticipants = !currentParticipants.includes(
        user.uid
      );
      const updatedParticipants = shouldAddSelfToParticipants
        ? [...currentParticipants, user.uid]
        : currentParticipants;
      const pendingCallUpdates = {};

      if (shouldAddSelfToParticipants) {
        pendingCallUpdates["call.callData.participants"] = updatedParticipants;
        // Set startTime when first participant joins (for call duration timer)
        // Only set if not already set (to preserve original start time in group calls)
        if (!callData.startTime) {
          pendingCallUpdates["call.callData.startTime"] = serverTimestamp();
        }
      }

      if (isVideoCall) {
        const desiredVideoEnabled = !!initialVideoEnabled;
        const currentVideoEnabled = callData.videoEnabled?.[user.uid];
        // Only write if currentVideoEnabled differs (e.g., refresh/reconnect/other tab could already set it).
        if (currentVideoEnabled !== desiredVideoEnabled) {
          pendingCallUpdates[`call.callData.videoEnabled.${user.uid}`] =
            desiredVideoEnabled;
        }
      }

      if (shouldClearStaleScreenSharing) {
        pendingCallUpdates[`call.screenSharingUids.${user.uid}`] =
          deleteField();
      }

      subscribeToSignals(chatId);
      subscribeToParticipants(chatId, localStream);

      const hasPendingCallUpdates = Object.keys(pendingCallUpdates).length > 0;
      if (hasPendingCallUpdates) {
        // Fire-and-forget metadata sync; signaling starts immediately.
        void updateDoc(chatRef, pendingCallUpdates).catch((error) => {
          console.warn("[useWebRTC] joinCall metadata update failed:", error);
        });
      }

      // 1. Initiate connections to everyone CURRENTLY in the list
      await initiateConnectionsToExistingParticipants(chatId, localStream);

      // Construct updated callData for Redux (mirror Firestore)
      const updatedCallData = {
        ...callData,
        participants: updatedParticipants,
      };
      const normalizedCallData = normalizeCallDataStartTime(updatedCallData);

      // Update callData in Redux, preserving current status if set (e.g. by onPlaying)
      const currentStatus = store.getState().chats.call.status;
      dispatch(
        setCall({
          isActive: true,
          callData: normalizedCallData,
          status: currentStatus,
        })
      );
    } catch (error) {
      console.error("Error joining call:", error);
      const latestStatus = store.getState().chats.call.status;
      if (latestStatus !== "Connecting...") return;
      const latestCallState = store.getState().chats.call;
      dispatch(
        setCall({
          ...latestCallState,
          status: "",
        })
      );
    }
  };

  const sendGroupCallSystemMsg = async (chatRef, chatData, callData) => {
    if (!callData?.isGroupCall) return;

    const startTime = callData.startTime?.toDate?.();
    const durationSeconds = startTime
      ? Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 1000))
      : 0;
    const durationLabel = formatDurationMinutes(durationSeconds);
    const isVideoCall = !!callData.isVideoCall;

    const msgId = uuid();
    const msgRef = doc(chatRef, "chatMessages", msgId);
    const newMsg = {
      msgId,
      type: "call-system",
      from: callData.participantDetails?.[callData.initiator] || user,
      msgReply: null,
      isMsgDelivered: true,
      isMsgRead: chatData.type === "private" ? false : [],
      timestamp: serverTimestamp(),
      callData: {
        kind: "group-start",
        isVideoCall,
        durationSeconds,
        durationLabel,
        initiatorUid: callData.initiator,
      },
    };
    const unreadCounts = { ...(chatData.unreadCounts || {}) };
    const senderUid = newMsg.from?.uid;
    for (const uid in unreadCounts) {
      if (uid !== senderUid) {
        unreadCounts[uid] = (unreadCounts[uid] || 0) + 1;
      }
    }

    await setDoc(msgRef, newMsg);
    await updateDoc(chatRef, {
      recentMsg: newMsg,
      timestamp: newMsg.timestamp,
      unreadCounts,
    });
  };

  const cleanupLocalCall = async () => {
    try {
      // 0. Stop local tracks early so camera/mic release isn't blocked by Firestore latency
      if (localStreamRef.current) {
        const localTracks = localStreamRef.current.getTracks();
        localTracks.forEach((track) => {
          track.stop();
        });
        localStreamRef.current = null;
      }

      // 2. Set "Call ended" status for UI feedback MAY NOT BE NEEDED SINCE WE HAVE IT IN LISTENER AND ()
      if (callState.status !== "Call ended") {
        dispatch(setCall({ ...callState, status: "Call ended" }));
      }

      // Capture chatId before clearing Redux state
      const chatId = callState.callData?.chatId;
      let shouldDeleteAllSignals = false;

      // 6. Remove self from participants and cleanup Firestore
      if (chatId) {
        try {
          const chatRef = doc(db, "chats", chatId);

          // Get current participants
          const snap = await getDoc(chatRef);
          if (snap.exists()) {
            const chatData = snap.data();
            const callData = chatData?.call?.callData;
            if (callData) {
              // Calculate new participants first
              const parts = callData.participants || [];
              const newParts = parts.filter((p) => p !== user.uid);

              // Determine if call should end
              // A call with < 2 participants should always end (any call type)
              const shouldEndCall = newParts.length < 2;

              if (shouldEndCall) {
                await updateDoc(chatRef, {
                  "call.isActive": false,
                  "call.status": "",
                  "call.callData": deleteField(),
                });
                shouldDeleteAllSignals = true;
                if (callData.isGroupCall) {
                  sendGroupCallSystemMsg(chatRef, chatData, callData).catch(
                    (error) => {
                      console.error(
                        "[useWebRTC] Error sending group call system message:",
                        error
                      );
                    }
                  );
                }
              } else {
                // Only update participants if call stays active
                await updateDoc(chatRef, {
                  [`call.callData.participants`]: newParts,
                });
              }
            }
            // Clear screen sharing state unconditionally
            // (runs even if callData was already deleted by other party)
            await updateDoc(chatRef, {
              [`call.screenSharingUids.${user.uid}`]: deleteField(),
            });
          }
        } catch (e) {
          console.error("[useWebRTC] Error leaving call:", e);
        }
      }
      // 1. Unsubscribe from Firestore listeners
      if (unsubscribeSignalsRef.current) {
        unsubscribeSignalsRef.current();
        unsubscribeSignalsRef.current = null;
      }
      if (unsubscribeParticipantsRef.current) {
        unsubscribeParticipantsRef.current();
        unsubscribeParticipantsRef.current = null;
      }

      // 3. Close all peer connections
      peerConnectionsRef.current.forEach((pc) => {
        pc.close();
      });
      peerConnectionsRef.current.clear();

      // 4. Stop all local tracks (second pass).
      // Scenario: user is screen sharing, hangUp triggers Step 0 stop(), which fires
      // screenTrack.onended -> stopScreenShare(). That callback can rebuild
      // localStreamRef.current (camera/dummy + audio) during cleanup. This pass
      // sweeps that late stream so no local capture survives after call end.
      if (localStreamRef.current) {
        const localTracks = localStreamRef.current.getTracks();
        localTracks.forEach((track) => {
          track.stop();
        });
        localStreamRef.current = null;
      }

      // 5. Stop all remote tracks and clear
      remoteStreamsRef.current.forEach((stream) => {
        const tracks = stream.getTracks();
        tracks.forEach((track) => {
          track.stop();
        });
      });
      remoteStreamsRef.current.clear();

      // IMMEDIATE UI UPDATE: Clear Redux state now to close modal immediately
      dispatch(setCall({ isActive: false, callData: {}, status: "" }));
      // 7. Clean up signals subcollection only when call has ended.
      // If the call is still active, deleting all signals can disrupt remaining participants.
      if (chatId && shouldDeleteAllSignals) {
        try {
          const signalsRef = collection(db, "chats", chatId, "signals");
          const signalsQuery = query(signalsRef);
          const signalsSnapshot = await getDocs(signalsQuery);
          const signalCount = signalsSnapshot.docs.length;

          if (signalCount > 0) {
            const deletePromises = signalsSnapshot.docs.map((doc) => {
              return deleteDoc(doc.ref);
            });
            await Promise.all(deletePromises);
          }
        } catch (error) {
          console.error("[useWebRTC] Error cleaning up signals:", error);
        }
      }
    } catch (error) {
      console.error("[useWebRTC] Error in cleanupLocalCall():", error);
      console.error("[useWebRTC] Error stack:", error.stack);
      throw error; // Re-throw so CallModal can catch it
    }
  };

  const getDummyVideoTrack = () => {
    if (
      dummyVideoTrackRef.current &&
      dummyVideoTrackRef.current.readyState !== "ended"
    ) {
      return dummyVideoTrackRef.current;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const stream = canvas.captureStream(5);
    const track = stream.getVideoTracks()[0];
    dummyVideoTrackRef.current = track;
    return track;
  };

  const getVideoSender = (pc) => {
    const transceiver = pc
      .getTransceivers?.()
      ?.find((t) => t.receiver?.track?.kind === "video");
    if (transceiver?.sender) return transceiver.sender;
    return pc.getSenders().find((s) => s.track?.kind === "video");
  };

  const startScreenShare = async () => {
    try {
      const captureController =
        typeof window !== "undefined" &&
        typeof window.CaptureController === "function"
          ? new window.CaptureController()
          : null;
      const displayConstraints = {
        video: true,
        ...(captureController ? { controller: captureController } : {}),
      };
      const screenStream = await navigator.mediaDevices.getDisplayMedia(
        displayConstraints
      );
      const screenTrack = screenStream.getVideoTracks()[0];

      if (captureController) {
        const displaySurface = screenTrack?.getSettings?.().displaySurface;
        if (displaySurface === "browser" || displaySurface === "window") {
          try {
            captureController.setFocusBehavior("no-focus-change");
          } catch (_) {
            // Unsupported browser/runtime path; keep default focus behavior.
          }
        }
      }

      screenTrackRef.current = screenTrack;
      const previousLocalStream = localStreamRef.current;

      // Replace video track in ALL peer connections
      peerConnectionsRef.current.forEach((pc) => {
        // sender.track can be null after camera OFF (replaceTrack(null)),
        // so resolve via transceiver when available.
        const videoSender = getVideoSender(pc);
        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        }
      });

      // Update local stream ref for preview
      const audioTracks = previousLocalStream
        ? previousLocalStream.getAudioTracks()
        : [];
      const audioTrack = audioTracks.length > 0 ? audioTracks[0] : null;
      const newStream = new MediaStream([screenTrack]);
      if (audioTrack) newStream.addTrack(audioTrack);

      localStreamRef.current = newStream;
      forceRender();

      // Update Firestore without blocking local UI swap.
      if (callState.callData?.chatId) {
        const chatRef = doc(db, "chats", callState.callData.chatId);
        updateDoc(chatRef, {
          [`call.screenSharingUids.${user.uid}`]: true,
        }).catch((error) => {
          console.error("[useWebRTC] Error setting screenSharingUids:", error);
        });
      }

      screenTrack.onended = () => {
        stopScreenShare();
      };

      return newStream;
    } catch (e) {
      const name = e?.name || "";
      // User cancelled/closed the browser picker (or dismissed permission prompt):
      // silently return without a toast.
      if (name === "AbortError" || name === "NotAllowedError") {
        return null;
      }
      console.error("Error sharing screen", e);
      notifyUser("Unable to start screen sharing.", "error");
      return null;
    }
  };

  const stopScreenShare = async (forceDummyTrack = null) => {
    try {
      const shouldUseDummyTrack =
        typeof forceDummyTrack === "boolean"
          ? forceDummyTrack
          : callState.callData?.videoEnabled?.[user.uid] === false;
      let nextVideoTrack = null;
      const previousLocalStream = localStreamRef.current;

      if (!shouldUseDummyTrack) {
        try {
          const cameraStream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          nextVideoTrack = cameraStream.getVideoTracks()[0];
        } catch (error) {
          console.error(
            "[useWebRTC] stopScreenShare getUserMedia failed:",
            error
          );
          notifyUser(
            getMediaPermissionMessage({ error, isAudioCall: false }),
            "info"
          );
          return null;
        }
      }

      peerConnectionsRef.current.forEach((pc) => {
        const videoSender = getVideoSender(pc);
        if (videoSender) {
          videoSender.replaceTrack(nextVideoTrack);
        }
      });

      const audioTracks = previousLocalStream
        ? previousLocalStream.getAudioTracks()
        : [];
      const audioTrack = audioTracks.length > 0 ? audioTracks[0] : null;
      const newStream = nextVideoTrack
        ? new MediaStream([nextVideoTrack])
        : new MediaStream();
      if (audioTrack) newStream.addTrack(audioTrack);

      localStreamRef.current = newStream;

      forceRender();

      // Update Firestore without blocking local UI swap.
      if (callState.callData?.chatId) {
        const chatRef = doc(db, "chats", callState.callData.chatId);
        updateDoc(chatRef, {
          [`call.screenSharingUids.${user.uid}`]: deleteField(),
        }).catch((error) => {
          console.error("[useWebRTC] Error clearing screenSharingUids:", error);
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
