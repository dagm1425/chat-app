import { useRef } from "react";
import {
  onSnapshot,
  collection,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";
import { useDispatch, useSelector } from "react-redux";
import { selectCall, setCall } from "../chatsSlice";
import { selectUser } from "../../user/userSlice";

const useWebRTC = (db) => {
  const dispatch = useDispatch();
  const callState = useSelector(selectCall);
  const user = useSelector(selectUser);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
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

  const updateCallStatusAndStartTime = async (chat, call) => {
    if (callState.status !== "Ongoing call") {
      dispatch(setCall({ ...call, status: "Ongoing call" }));
    }

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
      ...partialCallData,
      chatId: chat.chatId,
      roomId: roomRef.id,
    };
    const completeCall = {
      ...call,
      callData,
    };

    dispatch(setCall(completeCall));

    await updateDoc(chatRef, {
      call: {
        isActive: true,
        callData,
      },
    });

    onSnapshot(roomRef, async (snapshot) => {
      const data = snapshot.data();
      if (!peerConnection.currentRemoteDescription && data?.answer) {
        const answer = new RTCSessionDescription(data.answer);
        await peerConnection.setRemoteDescription(answer);
      }
    });

    peerConnection.addEventListener("track", (event) => {
      event.streams[0].getTracks().forEach(async (track) => {
        remoteStream.addTrack(track);
        updateCallStatusAndStartTime(chat, completeCall);
      });
    });

    onSnapshot(collection(roomRef, "calleeCandidates"), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          peerConnection.addIceCandidate(candidate);
        }
      });
    });
  };

  const updateJoinCallStates = (peerConnection, localStream, remoteStream) => {
    localStreamRef.current = localStream;
    remoteStreamRef.current = remoteStream;
    peerConnectionRef.current = peerConnection;
  };

  async function joinCall() {
    const roomRef = doc(
      db,
      "chats",
      callState.callData.chatId,
      "rooms",
      callState.callData.roomId
    );
    const roomSnapshot = await getDoc(roomRef);
    let peerConnection = null;
    let localStream = null;
    let remoteStream = null;

    if (roomSnapshot.exists()) {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
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

        if (callState.status !== "Ongoing call") {
          dispatch(setCall({ ...callState, status: "Ongoing call" }));
        }
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
      remoteStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    setTimeout(() => {
      dispatch(setCall({ isActive: false, callData: {}, status: "" }));
    }, 900);
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const screenTrack = screenStream.getVideoTracks()[0];

      if (peerConnectionRef.current) {
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(
          (sender) => sender.track && sender.track.kind === "video"
        );
        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        }
      }

      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      const newStream = new MediaStream([screenTrack]);
      if (audioTrack) {
        newStream.addTrack(audioTrack);
      }

      localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
      localStreamRef.current = newStream;

      if (callState.callData?.chatId) {
        const chatRef = doc(db, "chats", callState.callData.chatId);

        await updateDoc(chatRef, {
          [`call.screenSharingUids.${user.uid}`]: true,
        });
      }

      return newStream;
    } catch (e) {
      console.error("Error starting screen share", e);
      return null;
    }
  };

  const stopScreenShare = async () => {
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      const cameraTrack = cameraStream.getVideoTracks()[0];

      if (peerConnectionRef.current) {
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(
          (sender) => sender.track && sender.track.kind === "video"
        );
        if (videoSender) {
          videoSender.replaceTrack(cameraTrack);
        }
      }

      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      const newStream = new MediaStream([cameraTrack]);
      if (audioTrack) {
        newStream.addTrack(audioTrack);
      }

      localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
      localStreamRef.current = newStream;

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
    remoteStreamRef,
    peerConnectionRef,
    makeCall,
    joinCall,
    cleanupLocalCall,
    startScreenShare,
    stopScreenShare,
  };
};

export default useWebRTC;
