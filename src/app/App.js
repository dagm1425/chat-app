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

const toSerializable = (value) => {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();

  if (typeof value?.toDate === "function") {
    const parsed = value.toDate();
    return parsed instanceof Date ? parsed.toISOString() : parsed;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toSerializable(item));
  }

  if (typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, nestedValue]) => {
      acc[key] = toSerializable(nestedValue);
      return acc;
    }, {});
  }

  return value;
};

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
    dispatch(setUser(toSerializable(usern.data())));
  };

  const subscribeChats = () => {
    if (!user) return () => {};

    const q = query(
      collection(db, "chats"),
      where("memberIds", "array-contains", user.uid),
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
          const startTime =
            chat.call.callData.startTime &&
            typeof chat.call.callData.startTime.toDate === "function"
              ? chat.call.callData.startTime.toDate().toISOString()
              : chat.call.callData.startTime;
          call = {
            isActive: chat.call.isActive,
            callData: { ...chat.call.callData, startTime },
            status: "",
          };
        }
      });
      chats = chats.map((chat) => {
        const normalizedReadState = Object.entries(chat.readState || {}).reduce(
          (acc, [uid, state]) => {
            const cursor = state?.lastReadAt;
            acc[uid] = {
              lastReadAt:
                cursor && typeof cursor.toDate === "function"
                  ? cursor.toDate().toISOString()
                  : cursor instanceof Date
                  ? cursor.toISOString()
                  : cursor || null,
            };
            return acc;
          },
          {}
        );

        if (!chat.recentMsg) {
          return toSerializable({ ...chat, readState: normalizedReadState });
        }

        const date = chat.recentMsg.timestamp
          ? chat.recentMsg.timestamp.toDate().toISOString()
          : null;
        const callStartDate = chat.call?.callData?.startTime
          ? chat.call.callData.startTime.toDate().toISOString()
          : undefined;

        return toSerializable({
          ...chat,
          readState: normalizedReadState,
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
        });
      });

      setFetchingChatsData(false);
      dispatch(setChats(chats));

      const currentCallState = store.getState().chats.call;
      if (call && !currentCallState.isActive) {
        dispatch(setCall(toSerializable(call)));
      }
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
