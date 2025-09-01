import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import Sidebar from "./Sidebar";
import ChatsSection from "./ChatsSection";
import ChatsHome from "./ChatsHome";
import CallModal from "./CallModal";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { auth, db } from "../../firebase";
import { off, onValue, ref } from "firebase/database";
import { rtDb } from "../../firebase";
import { isToday, isYesterday, isThisYear, format, isSameWeek } from "date-fns";
import {
  onSnapshot,
  collection,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useDispatch, useSelector } from "react-redux";
import { selectCall, setCall } from "./chatsSlice";
import { selectUser } from "../user/userSlice";

function Home({ setUserStatus }) {
  const dispatch = useDispatch();
  const [selectedChatId, setSelectedChatId] = useState("");
  const [userStatuses, setUserStatuses] = useState({});
  const [userIds, setUserIds] = useState([]);
  const callState = useSelector(selectCall);
  const user = useSelector(selectUser);
  const configuration = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
      {
        urls: [
          "turn:15.236.82.248:3478?transport=udp",
          "turn:15.236.82.248:3478?transport=tcp",
        ],
        username: "webrtc",
        credential: "webrtc123",
      },
    ],
  };

  // const [peerConnection, setPeerConnection] = useState(null);
  // const [localStream, setLocalStream] = useState(null);
  // const [remoteStream, setRemoteStream] = useState(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);

  useEffect(() => {
    if (localStorage.getItem("auth") === "true")
      setUserStatus(auth.currentUser.uid, true);
  }, []);

  useEffect(() => {
    const usersRef = collection(db, "users");
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      let all_ids = [];
      snapshot.forEach((doc) => {
        all_ids.push(doc.id);
      });
      setUserIds(all_ids);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsubscribeFns = [];

    userIds.forEach((userId) => {
      const userStatusRef = ref(rtDb, "status/" + userId);
      const unsubscribe = onValue(userStatusRef, (snapshot) => {
        const value = snapshot.val();
        if (value === "online") {
          setUserStatuses((prevStatuses) => ({
            ...prevStatuses,
            [userId]: "online",
          }));
        } else {
          const lastSeenDate = new Date(value);
          setUserStatuses((prevStatuses) => ({
            ...prevStatuses,
            [userId]: formatLastSeen(lastSeenDate),
          }));
        }
      });
      unsubscribeFns.push(() => off(userStatusRef, unsubscribe));
    });

    return () => {
      unsubscribeFns.forEach((unsub) => unsub());
    };
  }, [userIds]);

  const formatLastSeen = (lastSeenDate) => {
    const currentDate = new Date();

    if (isToday(lastSeenDate)) {
      const formattedLastSeen = format(
        lastSeenDate,
        "'last seen today at' h:mm a"
      );
      return formattedLastSeen;
    } else if (isYesterday(lastSeenDate)) {
      const formattedLastSeen = format(
        lastSeenDate,
        "'last seen yesterday at' h:mm a"
      );
      return formattedLastSeen;
    } else if (isSameWeek(lastSeenDate, currentDate)) {
      const formattedLastSeen = format(
        lastSeenDate,
        "'last seen' eeee 'at' h:mm a"
      );
      return formattedLastSeen;
    } else if (isThisYear(lastSeenDate)) {
      const formattedLastSeen = format(lastSeenDate, "'last seen' dd/MM/yy");
      return formattedLastSeen;
    } else {
      const formattedLastSeen = format(lastSeenDate, "'last seen' dd/MM/yy");
      return formattedLastSeen;
    }
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
      console.log("adding local tracks");
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

    // Listening for updates to the room document
    onSnapshot(roomRef, async (snapshot) => {
      const data = snapshot.data();
      if (!peerConnection.currentRemoteDescription && data?.answer) {
        const answer = new RTCSessionDescription(data.answer);
        await peerConnection.setRemoteDescription(answer);
      }
    });

    // Code for creating a room below

    // Code for creating a room above

    // Code for collecting ICE candidates below

    // Code for collecting ICE candidates above

    peerConnection.addEventListener("track", (event) => {
      event.streams[0].getTracks().forEach(async (track) => {
        console.log("adding remote tracks");
        remoteStream.addTrack(track);
        updateCallStatusAndStartTime(chat, completeCall);
      });
    });

    // Listening for remote session description below

    // Listening for remote session description above

    // Listen for remote ICE candidates below
    onSnapshot(collection(roomRef, "calleeCandidates"), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          peerConnection.addIceCandidate(candidate);
        }
      });
    });
    // Listen for remote ICE candidates above
  };

  const updateJoinCallStates = (peerConnection, localStream, remoteStream) => {
    localStreamRef.current = localStream;
    remoteStreamRef.current = remoteStream;
    peerConnectionRef.current = peerConnection;
    // setPeerConnection(peerConnection);
    // setLocalStream(localStream);
    // setRemoteStream(remoteStream);
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
          console.log("Set remote description: ", data.answer);
          const answer = new RTCSessionDescription(data.answer);
          await peerConnection.setRemoteDescription(answer);
        }
      });
    }
  }

  return (
    <>
      <Router>
        <Sidebar
          selectedChatId={selectedChatId}
          setSelectedChatId={setSelectedChatId}
          userStatuses={userStatuses}
          setUserStatus={setUserStatus}
        />
        {callState.isActive && (
          <CallModal
            peerConnectionRef={peerConnectionRef}
            localStreamRef={localStreamRef}
            remoteStreamRef={remoteStreamRef}
            joinCall={joinCall}
          />
        )}
        <Routes>
          <Route path="/" element={<ChatsHome />}></Route>
          <Route
            path="/:id"
            element={
              <ChatsSection
                setSelectedChatId={setSelectedChatId}
                userStatuses={userStatuses}
                makeCall={makeCall}
              />
            }
          ></Route>
        </Routes>
      </Router>
    </>
  );
}

export default Home;

Home.propTypes = {
  setUserStatus: PropTypes.func,
};
