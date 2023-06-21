/* eslint-disable react/prop-types */
import React from "react";
import Sidebar from "./Sidebar";
import ChatsSection from "./ChatsSection";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

function Home() {
  return (
    <>
      <Router>
        <Sidebar />
        <Routes>
          <Route path="/:id" element={<ChatsSection />}></Route>
        </Routes>
      </Router>
    </>
  );
}

export default Home;
