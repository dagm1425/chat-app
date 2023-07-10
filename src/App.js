import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { setUser } from "./features/user/userSlice";
import UserLogin from "./features/user/userLogin";
import { setChats } from "./features/chats/chatsSlice";
import Home from "./features/chats/Home";
import CircularProgress from "@mui/material/CircularProgress";
import formatRelative from "date-fns/formatRelative";
import { enUS } from "date-fns/esm/locale";

function App() {
  const dispatch = useDispatch();
  const [isUserSignedIn, setIsUserSignedIn] = useState(false);
  const [userData, setUserData] = useState(null);
  const [fetchingUserData, setFetchingUserData] = useState(true);
  const [fetchingChatsData, setFetchingChatsData] = useState(true);
  const formatRelativeLocale = {
    lastWeek: " EEEE",
    yesterday: "'Yesterday'",
    today: "'Today'",
    tomorrow: " EEEE",
    nextWeek: " EEEE",
    other: "dd/MM/yyy",
  };
  const locale = {
    ...enUS,
    formatRelative: (token) => formatRelativeLocale[token],
  };

  useEffect(() => {
    let unsubscribe;

    onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserData(user);
        setIsUserSignedIn(true);
      } else {
        setIsUserSignedIn(false);
      }
    });

    fetchUserData();
    unsubscribe = subscribeChats();

    return () => {
      unsubscribe();
    };
  }, [isUserSignedIn]);

  const fetchUserData = async () => {
    if (!isUserSignedIn) return;

    const userRef = doc(db, "users", `${userData.uid}`);
    const user = await getDoc(userRef);

    if (!user.exists()) return;
    setFetchingUserData(false);
    dispatch(setUser(user.data()));
  };

  const subscribeChats = () => {
    if (!isUserSignedIn) return () => {};

    const q = query(
      collection(db, "chats"),
      where("members", "array-contains", {
        uid: userData.uid,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
      })
    );

    return onSnapshot(q, (querySnapshot) => {
      const chats = [];
      querySnapshot.forEach((doc) => {
        if (JSON.stringify(doc.data().recentMsg) !== "{}") {
          const timestamp = doc.data().recentMsg.timestamp.toDate();

          chats.push({
            ...doc.data(),
            recentMsg: {
              ...doc.data().recentMsg,
              timestamp: formatRelative(timestamp, Timestamp.now().toDate(), {
                locale,
              }),
            },
          });
        } else {
          chats.push(doc.data());
        }
      });
      setFetchingChatsData(false);
      dispatch(setChats(chats));
    });
  };

  if (!isUserSignedIn) return <UserLogin />;
  if (isUserSignedIn && (fetchingUserData || fetchingChatsData))
    return <CircularProgress />;
  return <Home />;
}

export default App;
