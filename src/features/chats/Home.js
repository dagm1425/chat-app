import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import Sidebar from "./Sidebar";
import ChatsSection from "./ChatsSection";
import ChatsHome from "./ChatsHome";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { auth, db } from "../../firebase";
import { off, onValue, ref } from "firebase/database";
import { rtDb } from "../../firebase";
import { formatDistance } from "date-fns";
import { onSnapshot, collection } from "firebase/firestore";

function Home({ setUserStatus }) {
  const [selectedChatId, setSelectedChatId] = useState("");
  const [userStatuses, setUserStatuses] = useState({});
  const [userIds, setUserIds] = useState([]);

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
          const now = new Date();
          const lastSeenDate = new Date(value);
          const timeDifferenceInMilliseconds = now - lastSeenDate;
          const hoursDifference =
            timeDifferenceInMilliseconds / (1000 * 60 * 60);

          let lastSeen;

          if (hoursDifference > 6 && hoursDifference <= 24 * 7) {
            lastSeen = "recently";
          } else {
            lastSeen = formatDistance(lastSeenDate, now, { addSuffix: true });
          }

          setUserStatuses((prevStatuses) => ({
            ...prevStatuses,
            [userId]: `last seen ${lastSeen}`,
          }));
        }
      });
      unsubscribeFns.push(() => off(userStatusRef, unsubscribe));
    });

    return () => {
      unsubscribeFns.forEach((unsub) => unsub());
    };
  }, [userIds]);

  return (
    <>
      <Router>
        <Sidebar
          selectedChatId={selectedChatId}
          setSelectedChatId={setSelectedChatId}
          userStatuses={userStatuses}
          setUserStatus={setUserStatus}
        />
        <Routes>
          <Route path="/" element={<ChatsHome />}></Route>
          <Route
            path="/:id"
            element={
              <ChatsSection
                setSelectedChatId={setSelectedChatId}
                userStatuses={userStatuses}
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
