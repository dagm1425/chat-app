/* eslint-disable react/prop-types */
import React, { useState } from "react";
import Sidebar from "./Sidebar";
import ChatsSection from "./ChatsSection";
import ChatsHome from "./ChatsHome";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

function Home() {
  const [selectedChatId, setSelectedChatId] = useState("");

  return (
    <>
      <Router>
        <Sidebar
          selectedChatId={selectedChatId}
          setSelectedChatId={setSelectedChatId}
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
