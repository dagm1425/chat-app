import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { auth, db } from "../firebase";
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
import UserLogin from "../features/user/userLogin";
import { setChats } from "../features/chats/chatsSlice";
import Home from "../features/chats/Home";
import CircularProgress from "@mui/material/CircularProgress";
import { useAuthState } from "react-firebase-hooks/auth";
// import formatRelative from "date-fns/formatRelative";
// import { enUS } from "date-fns/esm/locale";

function App() {
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
      orderBy("timestamp")
    );

    return onSnapshot(q, (querySnapshot) => {
      const chats = [];
      querySnapshot.forEach((doc) => {
        // eslint-disable-next-line no-unused-vars
        const { timestamp, ...chat } = doc.data();
        chats.push(chat);
      });

      setFetchingChatsData(false);
      dispatch(setChats(chats));
    });
  };

  if (!user) return <UserLogin />;
  if (loading || (user && (fetchingUserData || fetchingChatsData)))
    return <CircularProgress />;
  return <Home />;
}

export default App;
