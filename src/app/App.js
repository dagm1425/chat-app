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
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

const toSerializable = (value) => {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();

  const seconds = Number.isFinite(value?.seconds)
    ? value.seconds
    : value?._seconds;
  const nanoseconds = Number.isFinite(value?.nanoseconds)
    ? value.nanoseconds
    : value?._nanoseconds;
  if (Number.isFinite(seconds) && Number.isFinite(nanoseconds)) {
    return new Date(
      seconds * 1000 + Math.floor(nanoseconds / 1000000)
    ).toISOString();
  }

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
    try {
      if (!user) return;

      const userRef = doc(db, "users", `${user.uid}`);
      const usern = await getDoc(userRef);

      if (!usern.exists()) return;
      dispatch(setUser(toSerializable(usern.data())));
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setFetchingUserData(false);
    }
  };

  const subscribeChats = () => {
    if (!user) return () => {};

    const q = query(
      collection(db, "chats"),
      where("memberIds", "array-contains", user.uid),
      orderBy("timestamp", "desc")
    );

    return onSnapshot(
      q,
      (querySnapshot) => {
        try {
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
            const normalizedReadState = Object.entries(
              chat.readState || {}
            ).reduce((acc, [uid, state]) => {
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
            }, {});

            if (!chat.recentMsg) {
              return toSerializable({
                ...chat,
                readState: normalizedReadState,
              });
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

          dispatch(setChats(chats));

          const currentCallState = store.getState().chats.call;
          if (call && !currentCallState.isActive) {
            dispatch(setCall(toSerializable(call)));
          }
        } catch (error) {
          console.error("Error processing chats snapshot:", error);
        } finally {
          setFetchingChatsData(false);
        }
      },
      (error) => {
        console.error("Error subscribing to chats:", error);
        setFetchingChatsData(false);
      }
    );
  };

  const setUserStatus = (userId, isOnline) => {
    const status = isOnline ? "online" : serverTimestamp();
    const userStatusRef = ref(rtDb, "status/" + userId);
    set(userStatusRef, status);

    if (isOnline) {
      onDisconnect(userStatusRef).set(serverTimestamp());
    }
  };

  if (loading || (user && (fetchingUserData || fetchingChatsData)))
    return (
      <Box sx={{ height: "100vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );

  const shouldShowAuthRoutes = !user && !localStorage.getItem("auth");

  return (
    <Router>
      <Routes>
        <Route
          path="/sign-in"
          element={
            shouldShowAuthRoutes ? (
              <UserLogin mode="signin" setUserStatus={setUserStatus} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/sign-up"
          element={
            shouldShowAuthRoutes ? (
              <UserLogin mode="signup" setUserStatus={setUserStatus} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/*"
          element={
            shouldShowAuthRoutes ? (
              <Navigate to="/sign-in" replace />
            ) : (
              <Home setUserStatus={setUserStatus} />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
