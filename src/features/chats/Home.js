/* eslint-disable react/prop-types */
import React from "react";
import Userbar from "./UserBar";
import ChatsList from "./ChatsList";
import { Box } from "@mui/material";

function Home() {
  return (
    <Box sx={{ width: 1 / 4 }}>
      <Userbar />
      <ChatsList />
    </Box>
  );
}

export default Home;
