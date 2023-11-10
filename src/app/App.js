import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { auth, db, rtDb } from "../firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  // Timestamp,
} from "firebase/firestore";
import { setUser } from "../features/user/userSlice";
import UserLogin from "../features/user/UserLogin";
import { setChats } from "../features/chats/chatsSlice";
import Home from "../features/chats/Home";
import CircularProgress from "@mui/material/CircularProgress";
import { useAuthState } from "react-firebase-hooks/auth";
import { formatDate } from "../common/utils";
import { Box } from "@mui/material";
import { ref, set, serverTimestamp, onDisconnect } from "firebase/database";
// import formatRelative from "date-fns/formatRelative";
// import { enUS } from "date-fns/esm/locale";

function App() {
  // const chats = useSelector(selectChats);
  const dispatch = useDispatch();
  const [user, loading] = useAuthState(auth);
  const [fetchingUserData, setFetchingUserData] = useState(true);
  const [fetchingChatsData, setFetchingChatsData] = useState(true);
  // const formatRelativeLocale = {
  //   lastWeek: "EEEE",
  //   yesterday: "'Yesterday'",
  //   today: "'Today'",
  //   tomorrow: "EEEE",
  //   nextWeek: "EEEE",
  //   other: "dd/MM/yyy",
  // };
  // const locale = {
  //   ...enUS,
  //   formatRelative: (token) => formatRelativeLocale[token],
  // };

  useEffect(() => {
    let unsubscribe;

    fetchUserData();
    unsubscribe = subscribeChats();

    return () => {
      unsubscribe();
    };
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;

    const userRef = doc(db, "users", `${user.uid}`);
    const usern = await getDoc(userRef);

    if (!usern.exists()) return;
    setFetchingUserData(false);
    dispatch(setUser(usern.data()));
  };

  const subscribeChats = () => {
    if (!user) return () => {};

    const q = query(
      collection(db, "chats"),
      where("members", "array-contains", {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
      }),
      orderBy("timestamp", "desc")
    );

    return onSnapshot(q, (querySnapshot) => {
      let chats = [];
      querySnapshot.forEach((doc) => {
        // eslint-disable-next-line no-unused-vars
        const { timestamp, ...chat } = doc.data();
        chats.push(chat);
      });
      chats = chats.map((chat) => {
        if (chat.recentMsg === null) return chat;
        const date = chat.recentMsg.timestamp
          ? chat.recentMsg.timestamp.toDate()
          : new Date();

        return {
          ...chat,
          recentMsg: {
            ...chat.recentMsg,
            timestamp: formatDate(date),
          },
        };
      });

      setFetchingChatsData(false);
      dispatch(setChats(chats));
    });
  };

  const setUserStatus = (userId, isOnline) => {
    const status = isOnline ? "online" : serverTimestamp();
    const userStatusRef = ref(rtDb, "status/" + userId);
    set(userStatusRef, status);

    if (isOnline) {
      onDisconnect(userStatusRef).set(serverTimestamp());
    }
  };

  if (!user && !localStorage.getItem("auth"))
    return <UserLogin setUserStatus={setUserStatus} />;
  if (loading || (user && (fetchingUserData || fetchingChatsData)))
    return (
      <Box sx={{ height: "100vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  return <Home setUserStatus={setUserStatus} />;
}

export default App;
