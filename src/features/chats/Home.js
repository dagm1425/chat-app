/* eslint-disable react/prop-types */
import React from "react";
import Userbar from "./Userbar";
import ChatsList from "./ChatsList";
import ChatsSection from "./ChatsSection";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

function Home() {
  return (
    <>
      <Router>
        <Userbar />
        <ChatsList />
        <Routes>
          <Route path="/:id" element={<ChatsSection />}></Route>
        </Routes>
      </Router>
    </>
  );
}

export default Home;
