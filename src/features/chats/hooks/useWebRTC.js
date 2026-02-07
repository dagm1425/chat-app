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
import { store } from "../../../app/store";
import { formatDurationMinutes } from "../../../common/utils";

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

  const normalizeCallDataStartTime = (data) => {
    if (!data) return data;
    const startTime =
      data.startTime && typeof data.startTime.toDate === "function"
        ? data.startTime.toDate().toISOString()
        : data.startTime;
    return { ...data, startTime };
  };

  const createPeerConnection = useCallback(
    async (targetUserId, chatId, stream) => {
      if (peerConnectionsRef.current.has(targetUserId)) {
        console.warn(`[L48] Already have a connection for ${targetUserId}`);
        return peerConnectionsRef.current.get(targetUserId);
      }

      console.log(
        `[L53] Creating new RTCPeerConnection for targetUserId: ${targetUserId}`
      );
      const pc = new RTCPeerConnection(configuration);
      peerConnectionsRef.current.set(targetUserId, pc);
      console.log(
        `[L55] PeerConnection created and stored. Current PC count: ${peerConnectionsRef.current.size}`
      );

      // Add local tracks to this new connection
      if (stream) {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      }

      // Handle ICE candidates
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          console.log(
            `[L67] ICE candidate generated for ${targetUserId}, sending to Firestore`
          );
          const signalsRef = collection(db, "chats", chatId, "signals");
          await addDoc(signalsRef, {
            type: "candidate",
            from: user.uid,
            to: targetUserId,
            payload: event.candidate.toJSON(),
          });
          console.log(
            `[L73] ICE candidate sent to Firestore for ${targetUserId}`
          );
        } else {
          console.log(
            `[L65] ICE candidate gathering complete for ${targetUserId}`
          );
        }
      };

      // Handle incoming tracks
      pc.ontrack = (event) => {
        console.log(
          `[L77] ontrack event received from ${targetUserId}, track kind: ${event.track.kind}`
        );
        // Get existing stream or create new one
        let remoteStream = remoteStreamsRef.current.get(targetUserId);
        if (!remoteStream) {
          console.log(`[L81] Creating new MediaStream for ${targetUserId}`);
          remoteStream = new MediaStream();
          remoteStreamsRef.current.set(targetUserId, remoteStream);
        }

        // Add tracks that aren't already in the stream
        event.streams[0].getTracks().forEach((track) => {
          const existingTrack = remoteStream
            .getTracks()
            .find((t) => t.id === track.id);
          if (!existingTrack) {
            console.log(
              `[L91] Adding ${track.kind} track to remote stream for ${targetUserId}`
            );
            remoteStream.addTrack(track);
          }
        });

        forceRender(); // Trigger re-render to show new video
      };

      // Handle connection state changes (cleanup if disconnected)
      pc.onconnectionstatechange = () => {
        console.log(
          `[L99] PC connection state changed for ${targetUserId}: ${pc.connectionState}, signalingState: ${pc.signalingState}`
        );
        if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          console.log(
            `[L105] Cleaning up PC for ${targetUserId} due to state: ${pc.connectionState}`
          );
          remoteStreamsRef.current.delete(targetUserId);
          peerConnectionsRef.current.delete(targetUserId);
          forceRender();
        }
      };

      return pc;
    },
    [db, user.uid, forceRender]
  );

  const startCall = async (chat, isAudioCall) => {
    console.log(
      `[L116] startCall called: isAudioCall=${isAudioCall}, chatId=${chat.chatId}`
    );
    try {
      // 1. Get Local Stream
      console.log(
        `[L119] Requesting user media: video=${!isAudioCall}, audio=true`
      );
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: !isAudioCall,
        audio: true,
      });
      localStreamRef.current = localStream;
      console.log(
        `[debug speed] [CameraRelease] startCall getUserMedia streamId=${
          localStream.id
        } tracks=${localStream
          .getTracks()
          .map((t) => `${t.kind}:${t.id}:${t.readyState}`)
          .join(", ")}`
      );
      console.log(
        `[L123] Local stream obtained, tracks: ${localStream
          .getTracks()
          .map((t) => t.kind)
          .join(", ")}`
      );

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
      if (!data?.call?.callData) return;

      const participants = data.call.callData.participants || [];
      console.log(
        `[debug speed] [useWebRTC][Participants] snapshot @ ${new Date().toISOString()} chatId=${chatId} participants=${JSON.stringify(
          participants
        )}`
      );

      // Cleanup left participants
      const currentPeerIds = Array.from(peerConnectionsRef.current.keys());
      currentPeerIds.forEach((pid) => {
        if (!participants.includes(pid)) {
          // They left
          console.log(
            `[debug speed] [useWebRTC][Participants] left @ ${new Date().toISOString()} uid=${pid}`
          );
          const pc = peerConnectionsRef.current.get(pid);
          pc.close();
          peerConnectionsRef.current.delete(pid);
          const hadStream = remoteStreamsRef.current.has(pid);
          remoteStreamsRef.current.delete(pid);
          console.log(
            `[debug speed] [useWebRTC][Participants] remote stream removed @ ${new Date().toISOString()} uid=${pid} hadStream=${hadStream}`
          );
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

  const joinCall = async (previewStream = null, initialVideoEnabled = true) => {
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

      // Get stream based on call type (reuse preview stream if available)
      const hasLivePreview =
        previewStream &&
        previewStream.getTracks().some((track) => track.readyState === "live");
      let localStream;
      if (hasLivePreview) {
        console.log("[L327] Using preview stream for joinCall");
        localStream = previewStream;
        console.log(
          `[debug speed] [CameraRelease] joinCall using preview streamId=${
            localStream.id
          } tracks=${localStream
            .getTracks()
            .map((t) => `${t.kind}:${t.id}:${t.readyState}`)
            .join(", ")}`
        );
      } else {
        // Fallback: no usable preview (voice call or preview missing after refresh/denied permissions)
        console.log(
          `[L327] Requesting user media: video=${isVideoCall}, audio=true`
        );
        localStream = await navigator.mediaDevices.getUserMedia({
          video: isVideoCall && initialVideoEnabled,
          audio: true,
        });
        console.log(
          `[debug speed] [CameraRelease] joinCall getUserMedia streamId=${
            localStream.id
          } tracks=${localStream
            .getTracks()
            .map((t) => `${t.kind}:${t.id}:${t.readyState}`)
            .join(", ")}`
        );
        if (isVideoCall && !initialVideoEnabled) {
          const dummyTrack = getDummyVideoTrack();
          localStream.addTrack(dummyTrack);
        }
      }
      localStreamRef.current = localStream;
      console.log(
        `[debug speed] [CameraRelease] joinCall localStreamRef set streamId=${localStream.id}`
      );
      console.log(
        `[L331] Local stream obtained, tracks: ${localStream
          .getTracks()
          .map((t) => t.kind)
          .join(", ")}`
      );

      const currentParticipants = callData.participants || [];
      console.log(
        `[L333] Current participants: ${JSON.stringify(currentParticipants)}`
      );

      console.log(`[L335] Setting up signal subscriptions`);
      subscribeToSignals(chatId);
      subscribeToParticipants(chatId, localStream);

      // 1. Initiate connections to everyone CURRENTLY in the list
      console.log(`[L339] Initiating connections to existing participants`);
      await initiateConnectionsToExistingParticipants(chatId, localStream);

      // 2. Add self to participants and participantDetails using a canonical variable
      let updatedParticipants = currentParticipants;
      if (!updatedParticipants.includes(user.uid)) {
        updatedParticipants = [...currentParticipants, user.uid];
        console.log(
          `[L343] Adding self to participants: ${
            user.uid
          }, updatedParticipants: ${JSON.stringify(updatedParticipants)}`
        );

        await updateDoc(chatRef, {
          [`call.callData.participants`]: updatedParticipants,
        });

        // Set startTime when first participant joins (for call duration timer)
        // Only set if not already set (to preserve original start time in group calls)
        if (!callData.startTime) {
          await updateDoc(chatRef, {
            "call.callData.startTime": serverTimestamp(),
          });
        }
      } else {
        console.log(`[L343] Self already present in participants: ${user.uid}`);
      }

      if (isVideoCall) {
        const desiredVideoEnabled = !!initialVideoEnabled;
        const currentVideoEnabled = callData.videoEnabled?.[user.uid];
        // Only write if currentVideoEnabled differs (e.g., refresh/reconnect/other tab could already set it to true).
        if (currentVideoEnabled !== desiredVideoEnabled) {
          await updateDoc(chatRef, {
            [`call.callData.videoEnabled.${user.uid}`]: desiredVideoEnabled,
          });
        }
      }

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

    await setDoc(msgRef, newMsg);
    await updateDoc(chatRef, { recentMsg: newMsg });
    await updateDoc(chatRef, { timestamp: newMsg.timestamp });
  };

  const cleanupLocalCall = async () => {
    const cleanupStart = Date.now();
    try {
      console.log("[useWebRTC] cleanupLocalCall() called");

      // 0. Stop local tracks early so camera/mic release isn't blocked by Firestore latency
      console.log(
        "[debug speed] [CameraRelease] Step 0: Stopping local tracks early"
      );
      if (localStreamRef.current) {
        const localTracks = localStreamRef.current.getTracks();
        console.log(
          `[debug speed] [CameraRelease] Early stop of ${
            localTracks.length
          } local tracks @ ${new Date().toISOString()}`
        );
        localTracks.forEach((track) => {
          console.log(
            `[debug speed] [CameraRelease] Early stopping local ${
              track.kind
            } track id=${track.id} state=${track.readyState} enabled=${
              track.enabled
            } @ ${new Date().toISOString()}`
          );
          if (!track.onended) {
            track.onended = () => {
              console.log(
                `[debug speed] [CameraRelease] Local ${
                  track.kind
                } track ended id=${track.id} @ ${new Date().toISOString()}`
              );
            };
          }
          track.stop();
          console.log(
            `[debug speed] [CameraRelease] Local ${
              track.kind
            } track stop() called id=${track.id} state=${
              track.readyState
            } @ ${new Date().toISOString()}`
          );
        });
        localStreamRef.current = null;
        console.log(
          "[debug speed] [CameraRelease] Local stream cleared (early)"
        );
      } else {
        console.log(
          `[debug speed] [CameraRelease] No local stream to stop early @ ${new Date().toISOString()}`
        );
      }

      // 2. Set "Call ended" status for UI feedback MAY NOT BE NEEDED SINCE WE HAVE IT IN LISTENER AND ()
      console.log("[useWebRTC] Step 2: Setting 'Call ended' status");
      if (callState.status !== "Call ended") {
        dispatch(setCall({ ...callState, status: "Call ended" }));
        console.log("[useWebRTC] Status set to 'Call ended'");
      } else {
        console.log("[useWebRTC] Status already 'Call ended', skipping");
      }

      // Capture chatId before clearing Redux state
      const chatId = callState.callData?.chatId;

      // 6. Remove self from participants and cleanup Firestore
      if (chatId) {
        console.log("[useWebRTC] Step 6: Updating Firestore");
        console.log(`[useWebRTC] ChatId: ${chatId}`);
        try {
          const chatRef = doc(db, "chats", chatId);

          // Get current participants
          console.log(
            "[useWebRTC] Getting current participants from Firestore"
          );
          const getDocStart = Date.now();
          const snap = await getDoc(chatRef);
          console.log(
            `[debug speed] [useWebRTC][CallEnd] getDoc completed @ ${new Date().toISOString()} durationMs=${
              Date.now() - getDocStart
            } chatId=${chatId}`
          );
          if (snap.exists()) {
            const chatData = snap.data();
            const callData = chatData?.call?.callData;
            if (callData) {
              // Calculate new participants first
              const parts = callData.participants || [];
              console.log(
                `[useWebRTC] Current participants: ${JSON.stringify(parts)}`
              );
              const newParts = parts.filter((p) => p !== user.uid);
              console.log(
                `[useWebRTC] Participants after removing self: ${JSON.stringify(
                  newParts
                )}`
              );

              // Determine if call should end
              // A call with < 2 participants should always end (any call type)
              const shouldEndCall = newParts.length < 2;

              if (shouldEndCall) {
                console.log(
                  `[useWebRTC] Closing call in Firestore, remaining: ${newParts.length})`
                );
                console.log(
                  `[debug speed] [useWebRTC][CallEnd] writing @ ${new Date().toISOString()} chatId=${chatId}`
                );
                await updateDoc(chatRef, {
                  "call.isActive": false,
                  "call.status": "",
                  "call.callData": deleteField(),
                });
                console.log(
                  `[debug speed] [useWebRTC][CallEnd] write completed @ ${new Date().toISOString()} chatId=${chatId}`
                );
                console.log("[useWebRTC] Call closed in Firestore");
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
                console.log(
                  `[useWebRTC] ${newParts.length} participants remaining, call stays active`
                );
                // Only update participants if call stays active
                console.log("[useWebRTC] Updating participants in Firestore");
                await updateDoc(chatRef, {
                  [`call.callData.participants`]: newParts,
                });
                console.log("[useWebRTC] Participants updated in Firestore");
              }
            } else {
              console.log("[useWebRTC] No callData found in Firestore");
            }

            // Clear screen sharing state unconditionally
            // (runs even if callData was already deleted by other party)
            console.log(
              `[useWebRTC] Clearing screenSharingUids for ${user.uid}`
            );
            await updateDoc(chatRef, {
              [`call.screenSharingUids.${user.uid}`]: deleteField(),
            });
            console.log("[useWebRTC] Screen sharing state cleared");
          } else {
            console.log("[useWebRTC] Chat document does not exist");
          }
        } catch (e) {
          console.error("[useWebRTC] Error leaving call:", e);
        }
      } else {
        console.log(
          "[useWebRTC] No chatId in callData, skipping Firestore update"
        );
      }

      console.log("[useWebRTC] Current state:", {
        chatId: chatId,
        participants: callState.callData?.participants,
        peerConnectionsCount: peerConnectionsRef.current.size,
        remoteStreamsCount: remoteStreamsRef.current.size,
      });

      // 1. Unsubscribe from Firestore listeners
      console.log("[useWebRTC] Step 1: Unsubscribing from Firestore listeners");
      if (unsubscribeSignalsRef.current) {
        console.log("[useWebRTC] Unsubscribing from signals listener");
        unsubscribeSignalsRef.current();
        unsubscribeSignalsRef.current = null;
      }
      if (unsubscribeParticipantsRef.current) {
        console.log("[useWebRTC] Unsubscribing from participants listener");
        unsubscribeParticipantsRef.current();
        unsubscribeParticipantsRef.current = null;
      }

      // 3. Close all peer connections
      console.log(
        `[useWebRTC] Step 3: Closing ${peerConnectionsRef.current.size} peer connections`
      );
      peerConnectionsRef.current.forEach((pc, userId) => {
        console.log(
          `[useWebRTC] Closing PC for ${userId}, state: ${pc.connectionState}`
        );
        pc.close();
      });
      peerConnectionsRef.current.clear();
      console.log("[useWebRTC] All peer connections closed and cleared");

      // 4. Stop all local tracks
      console.log("[useWebRTC] Step 4: Stopping local tracks");
      if (localStreamRef.current) {
        const localTracks = localStreamRef.current.getTracks();
        console.log(`[useWebRTC] Stopping ${localTracks.length} local tracks`);
        localTracks.forEach((track) => {
          console.log(`[useWebRTC] Stopping local ${track.kind} track`);
          track.stop();
        });
        localStreamRef.current = null;
        console.log("[useWebRTC] Local stream cleared");
      } else {
        console.log("[useWebRTC] No local stream to stop");
      }

      // 5. Stop all remote tracks and clear
      console.log(
        `[useWebRTC] Step 5: Stopping ${remoteStreamsRef.current.size} remote streams`
      );
      remoteStreamsRef.current.forEach((stream, userId) => {
        const tracks = stream.getTracks();
        console.log(
          `[useWebRTC] Stopping ${tracks.length} tracks for ${userId}`
        );
        tracks.forEach((track) => {
          console.log(
            `[useWebRTC] Stopping remote ${track.kind} track for ${userId}`
          );
          track.stop();
        });
      });
      remoteStreamsRef.current.clear();
      console.log("[useWebRTC] All remote streams stopped and cleared");

      // IMMEDIATE UI UPDATE: Clear Redux state now to close modal immediately
      console.log(
        "[useWebRTC] Clearing Redux state to close modal (isActive: false)"
      );
      dispatch(setCall({ isActive: false, callData: {}, status: "" }));

      console.log("[useWebRTC] Redux state cleared, Firestore already updated");

      // 7. Clean up signals subcollection
      if (chatId) {
        console.log("[useWebRTC] Step 7: Cleaning up signals subcollection");
        try {
          const signalsRef = collection(db, "chats", chatId, "signals");
          const signalsQuery = query(signalsRef);
          const signalsSnapshot = await getDocs(signalsQuery);
          const signalCount = signalsSnapshot.docs.length;
          console.log(
            `[useWebRTC] Found ${signalCount} signal documents to delete`
          );

          if (signalCount > 0) {
            const deletePromises = signalsSnapshot.docs.map((doc) => {
              console.log(`[useWebRTC] Deleting signal document: ${doc.id}`);
              return deleteDoc(doc.ref);
            });
            await Promise.all(deletePromises);
            console.log(
              `[useWebRTC] Successfully deleted ${signalCount} signal documents`
            );
          } else {
            console.log("[useWebRTC] No signals to delete");
          }
        } catch (error) {
          console.error("[useWebRTC] Error cleaning up signals:", error);
        }
      } else {
        console.log("[useWebRTC] No chatId, skipping signal cleanup");
      }

      console.log("[useWebRTC] cleanupLocalCall() completed");
      console.log(
        `[useWebRTC] cleanupLocalCall() durationMs=${Date.now() - cleanupStart}`
      );
    } catch (error) {
      console.error("[useWebRTC] Error in cleanupLocalCall():", error);
      console.error("[useWebRTC] Error stack:", error.stack);
      console.log(
        `[useWebRTC] cleanupLocalCall() failed afterMs=${
          Date.now() - cleanupStart
        }`
      );
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

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const screenTrack = screenStream.getVideoTracks()[0];
      screenTrackRef.current = screenTrack;
      const previousLocalStream = localStreamRef.current;

      // Replace video track in ALL peer connections
      peerConnectionsRef.current.forEach((pc) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(
          (s) => s.track && s.track.kind === "video"
        );
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
      console.error("Error sharing screen", e);
      return null;
    }
  };

  const stopScreenShare = async () => {
    try {
      const shouldUseDummyTrack =
        callState.callData?.videoEnabled?.[user.uid] === false;
      let nextVideoTrack;
      const previousLocalStream = localStreamRef.current;

      if (shouldUseDummyTrack) {
        nextVideoTrack = getDummyVideoTrack();
      } else {
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        nextVideoTrack = cameraStream.getVideoTracks()[0];
      }

      peerConnectionsRef.current.forEach((pc) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(
          (s) => s.track && s.track.kind === "video"
        );
        if (videoSender) {
          videoSender.replaceTrack(nextVideoTrack);
        }
      });

      const audioTracks = previousLocalStream
        ? previousLocalStream.getAudioTracks()
        : [];
      const audioTrack = audioTracks.length > 0 ? audioTracks[0] : null;
      const newStream = new MediaStream([nextVideoTrack]);
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
