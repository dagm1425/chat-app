/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import ChatsSection from "./ChatsSection";
import ChatsHome from "./ChatsHome";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { auth } from "../../firebase";

function Home({ setUserStatus }) {
  const [selectedChatId, setSelectedChatId] = useState("");

  useEffect(() => {
    if (localStorage.getItem("auth") === "true")
      setUserStatus(auth.currentUser.uid, true);
  }, []);

  return (
    <>
      <Router>
        <Sidebar
          selectedChatId={selectedChatId}
          setSelectedChatId={setSelectedChatId}
          setUserStatus={setUserStatus}
        />
        <Routes>
          <Route path="/" element={<ChatsHome />}></Route>
          <Route
            path="/:id"
            element={<ChatsSection setSelectedChatId={setSelectedChatId} />}
          ></Route>
        </Routes>
      </Router>
    </>
  );
}

export default Home;
