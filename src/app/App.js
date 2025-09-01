import React, { useEffect, useState } from "react";
import { auth, db, rtDb } from "../firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { useDispatch } from "react-redux";
import { setUser } from "../features/user/userSlice";
import UserLogin from "../features/user/UserLogin";
import { setChats, setCall } from "../features/chats/chatsSlice";
import Home from "../features/chats/Home";
import CircularProgress from "@mui/material/CircularProgress";
import { useAuthState } from "react-firebase-hooks/auth";
import { formatDate } from "../common/utils";
import { Box } from "@mui/material";
import { ref, set, serverTimestamp, onDisconnect } from "firebase/database";
import { store } from "../app/store";

function App() {
  const dispatch = useDispatch();
  const [user, loading] = useAuthState(auth);
  const [fetchingUserData, setFetchingUserData] = useState(true);
  const [fetchingChatsData, setFetchingChatsData] = useState(true);

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
      let call = null;

      querySnapshot.forEach((doc) => {
        // eslint-disable-next-line no-unused-vars
        const { timestamp, ...chat } = doc.data();
        chats.push(chat);

        if (chat.call?.isActive && chat.call?.callData) {
          call = {
            isActive: chat.call.isActive,
            callData: chat.call.callData,
            status: "",
          };
        }
      });
      chats = chats.map((chat) => {
        if (!chat.recentMsg) return chat;

        const date = chat.recentMsg.timestamp
          ? chat.recentMsg.timestamp.toDate().toISOString()
          : null;
        const callStartDate = chat.call?.callData?.startTime
          ? chat.call.callData.startTime.toDate().toISOString()
          : undefined;

        return {
          ...chat,
          recentMsg: {
            ...chat.recentMsg,
            timestamp: formatDate(date),
          },
          call: chat.call
            ? {
                ...chat.call,
                callData: {
                  ...chat.call.callData,
                  startTime: callStartDate,
                },
              }
            : undefined,
        };
      });

      setFetchingChatsData(false);
      dispatch(setChats(chats));

      const currentCallState = store.getState().chats.call;
      if (call && !currentCallState.isActive) dispatch(setCall(call));
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
