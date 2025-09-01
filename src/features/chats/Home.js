import React, { useEffect, useState } from "react";
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
import { onSnapshot, collection } from "firebase/firestore";
import { useSelector } from "react-redux";
import { selectCall } from "./chatsSlice";
import useWebRTC from "./hooks/useWebRTC";

function Home({ setUserStatus }) {
  const [selectedChatId, setSelectedChatId] = useState("");
  const [userStatuses, setUserStatuses] = useState({});
  const [userIds, setUserIds] = useState([]);
  const callState = useSelector(selectCall);
  const {
    localStreamRef,
    remoteStreamRef,
    peerConnectionRef,
    makeCall,
    joinCall,
  } = useWebRTC(db);

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
