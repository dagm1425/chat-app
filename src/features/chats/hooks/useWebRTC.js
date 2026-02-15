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
        const existingPc = peerConnectionsRef.current.get(targetUserId);
        const existingAgeMs = existingPc?.__createdAt
          ? Date.now() - existingPc.__createdAt
          : null;
        console.warn(
          `[debug speed] [RejoinFlow] [L48] Already have a connection for ${targetUserId} state=${existingPc?.connectionState} signaling=${existingPc?.signalingState} ageMs=${existingAgeMs}`
        );
        return existingPc;
      }

      console.log(
        `[L53] Creating new RTCPeerConnection for targetUserId: ${targetUserId}`
      );
      const pc = new RTCPeerConnection(configuration);
      pc.__createdAt = Date.now();
      peerConnectionsRef.current.set(targetUserId, pc);
      console.log(
        `[debug speed] [RejoinFlow] [L55] PeerConnection created and stored. Current PC count: ${peerConnectionsRef.current.size} createdAt=${pc.__createdAt}`
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
          const offerId = pc.__offerId;
          if (!offerId) {
            console.log(
              `[debug speed] [RejoinFlow] [ICE] Missing offerId for ${targetUserId}, skipping candidate`
            );
            return;
          }
          console.log(
            `[L67] ICE candidate generated for ${targetUserId}, sending to Firestore`
          );
          const signalsRef = collection(db, "chats", chatId, "signals");
          await addDoc(signalsRef, {
            type: "candidate",
            from: user.uid,
            to: targetUserId,
            offerId,
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
        const pcAgeMs = pc.__createdAt ? Date.now() - pc.__createdAt : null;
        const mappedPc = peerConnectionsRef.current.get(targetUserId);
        console.log(
          `[debug speed] [RejoinFlow] [L99] PC connection state changed for ${targetUserId}: ${pc.connectionState}, signalingState: ${pc.signalingState}, ageMs=${pcAgeMs}`
        );
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
          console.log(
            `[debug speed] [RejoinFlow] [Reconnect] Cleaning up PC for ${targetUserId} due to state: ${pc.connectionState}, ageMs=${pcAgeMs}`
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
    // 1. Get Local Stream
    console.log(
      `[L119] Requesting user media: video=${!isAudioCall}, audio=true`
    );
    let localStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: !isAudioCall,
        audio: true,
      });
    } catch (error) {
      console.error("[L120] getUserMedia failed:", error);
      notifyUser(getMediaPermissionMessage({ error, isAudioCall }), "error");
      return;
    }

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
    console.log(
      `[L162] Setting up signal subscriptions for chatId: ${chat.chatId}`
    );
    subscribeToSignals(chat.chatId);
    subscribeToParticipants(chat.chatId, localStream);
    console.log(`[L163] startCall completed successfully`);
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
      const offerId = uuid();
      pc.__offerId = offerId;
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
        offerId,
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
      console.log(
        `[debug speed] [RejoinFlow] [Signals] snapshot @ ${new Date().toISOString()} chatId=${chatId} size=${
          snapshot.size
        } fromCache=${snapshot.metadata.fromCache} hasPendingWrites=${
          snapshot.metadata.hasPendingWrites
        }`
      );
      // Process signals sequentially to avoid race conditions
      // (e.g., ICE candidate processed before offer/answer)
      for (const change of snapshot.docChanges()) {
        if (change.type === "added") {
          const data = change.doc.data();
          const senderUid = data.from;
          const { type, payload } = data;
          const createdAt = change.doc.createTime
            ? change.doc.createTime.toDate().toISOString()
            : "unknown";
          console.log(
            `[L256] Processing ${change.type} signal: type=${type}, from=${senderUid}, docId=${change.doc.id}`
          );
          console.log(
            `[debug speed] [RejoinFlow] [Signals] added docId=${change.doc.id} type=${type} from=${senderUid} createdAt=${createdAt}`
          );
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
          console.log(
            `[L262] PC lookup for ${senderUid}: ${pc ? "EXISTS" : "NOT FOUND"}`
          );
          if (pc) {
            const pcAgeMs = pc.__createdAt ? Date.now() - pc.__createdAt : null;
            console.log(
              `[debug speed] [RejoinFlow] [Signals] pc state for ${senderUid}: signaling=${
                pc.signalingState
              } connection=${pc.connectionState} localDesc=${
                pc.localDescription?.type || "none"
              } remoteDesc=${pc.remoteDescription?.type || "none"}`
            );
            console.log(
              `[debug speed] [RejoinFlow] pc reuse candidate for ${senderUid} ageMs=${pcAgeMs}`
            );
          }

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
          } else if (pc && type === "offer") {
            console.log(
              `[debug speed] [RejoinFlow] received OFFER for existing PC from ${senderUid} signaling=${
                pc.signalingState
              } connection=${pc.connectionState} localDesc=${
                pc.localDescription?.type || "none"
              } remoteDesc=${pc.remoteDescription?.type || "none"}`
            );
          }

          if (!pc) {
            console.log(`[L274] No PC available, skipping signal processing`);
            await consumeSignalDoc("no-pc");
            continue;
          }

          console.log(
            `[L276] Processing ${type} signal. PC signalingState: ${pc.signalingState}, connectionState: ${pc.connectionState}`
          );

          if (type === "offer") {
            try {
              console.log(`[L277] Handling OFFER from ${senderUid}`);
              const remoteDesc = new RTCSessionDescription(payload);
              const offerId = data.offerId;
              if (!offerId) {
                console.log(
                  `[debug speed] [RejoinFlow] Missing offerId on OFFER from ${senderUid}, skipping`
                );
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
                console.log(
                  `[debug speed] [RejoinFlow] Ignoring OFFER in non-stable state (${pc.signalingState}) from ${senderUid}`
                );
                await consumeSignalDoc(reason);
                continue;
              }
              pc.__offerId = offerId;
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
              console.log(
                `[L284] Sending answer to Firestore for ${senderUid}`
              );
              await addDoc(signalsRef, {
                type: "answer",
                from: user.uid,
                to: senderUid,
                offerId,
                payload: { type: answer.type, sdp: answer.sdp },
              });
              console.log(`[L289] Answer sent to Firestore for ${senderUid}`);
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
              console.log(
                `[L290] Handling ANSWER from ${senderUid}. Current signalingState: ${pc.signalingState}`
              );
              const offerId = data.offerId;
              if (!offerId || pc.__offerId !== offerId) {
                console.log(
                  `[debug speed] [RejoinFlow] Ignoring ANSWER (offerId=${
                    offerId || "none"
                  }, expected=${pc.__offerId || "none"})`
                );
                await consumeSignalDoc("answer-ignored-offerid-mismatch");
                continue;
              }
              // Ignore late/duplicate answers (e.g., after refresh/rejoin).
              if (pc.signalingState !== "have-local-offer") {
                console.log(
                  `[L292] Ignoring ANSWER (state=${
                    pc.signalingState
                  }, remoteDesc=${pc.remoteDescription?.type || "none"})`
                );
                await consumeSignalDoc("answer-ignored-state");
                continue;
              }
              const remoteDesc = new RTCSessionDescription(payload);
              console.log(
                `[L293] Setting remote description (answer). Current signalingState: ${pc.signalingState}, connectionState: ${pc.connectionState}`
              );
              try {
                await pc.setRemoteDescription(remoteDesc);
                console.log(
                  `[L293] Remote description (answer) set successfully. New signalingState: ${pc.signalingState}`
                );
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
            console.log(`[L295] Handling ICE CANDIDATE from ${senderUid}`);
            try {
              const offerId = data.offerId;
              if (!offerId || pc.__offerId !== offerId) {
                console.log(
                  `[debug speed] [RejoinFlow] Ignoring CANDIDATE (offerId=${
                    offerId || "none"
                  }, expected=${pc.__offerId || "none"})`
                );
                await consumeSignalDoc("candidate-ignored-offerid-mismatch");
                continue;
              }
              const candidate = new RTCIceCandidate(payload);
              console.log(
                `[L296] Adding ICE candidate. Current signalingState: ${pc.signalingState}`
              );
              await pc.addIceCandidate(candidate);
              console.log(`[L296] ICE candidate added successfully`);
              await consumeSignalDoc("candidate-handled");
            } catch (error) {
              // Ignore if remote description not set - new candidates will be generated
              if ((error?.message || "").includes("remote description")) {
                console.log(
                  `[L296] Skipping candidate - remote description not ready yet`
                );
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
      const wasMarkedScreenSharing =
        !!chatSnapshot.data()?.call?.screenSharingUids?.[user.uid];
      if (wasMarkedScreenSharing) {
        // Refresh/rejoin scenario: OS/browser always ends display capture on refresh,
        // so a persisted screenSharingUids.<uid>=true is stale and makes peers render
        // the remote tile as "video/share on" instead of avatar when camera intent is off.
        // Clear it before negotiation so remote UI state matches real media tracks.
        try {
          await updateDoc(chatRef, {
            [`call.screenSharingUids.${user.uid}`]: deleteField(),
          });
        } catch (error) {
          console.warn(
            "[useWebRTC] joinCall failed to clear stale screenSharingUids flag:",
            error
          );
        }
      }

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
        try {
          localStream = await navigator.mediaDevices.getUserMedia({
            video: isVideoCall && initialVideoEnabled,
            audio: true,
          });
        } catch (error) {
          console.error("[L328] joinCall getUserMedia failed:", error);
          notifyUser(
            getMediaPermissionMessage({ error, isAudioCall: !isVideoCall }),
            "error"
          );
          return;
        }
        console.log(
          `[debug speed] [CameraRelease] joinCall getUserMedia streamId=${
            localStream.id
          } tracks=${localStream
            .getTracks()
            .map((t) => `${t.kind}:${t.id}:${t.readyState}`)
            .join(", ")}`
        );
      }
      // On join we still need a video sender so remote frame/onPlaying readiness
      // logic (used to transition call UI to "Ongoing call", especially in group)
      // can proceed predictably.
      if (
        isVideoCall &&
        !initialVideoEnabled &&
        localStream.getVideoTracks().length === 0
      ) {
        const dummyTrack = getDummyVideoTrack();
        localStream.addTrack(dummyTrack);
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

      // 4. Stop all local tracks (second pass).
      // Scenario: user is screen sharing, hangUp triggers Step 0 stop(), which fires
      // screenTrack.onended -> stopScreenShare(). That callback can rebuild
      // localStreamRef.current (camera/dummy + audio) during cleanup. This pass
      // sweeps that late stream so no local capture survives after call end.
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
            "error"
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
