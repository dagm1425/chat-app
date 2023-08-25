/* eslint-disable react/prop-types */
import React, { useState } from "react";
import UserDrawer from "./UserDrawer";
import ChatsList from "./ChatsList";
import ChatsSearchBar from "./ChatsSearchBar";
import { Box } from "@mui/material";

function Sidebar({ selectedChatId, setSelectedChatId }) {
  const [searchValue, setSearchValue] = useState("");

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "22%",
        height: "100vh",
        bgcolor: "#f8ebd3",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <UserDrawer setSelectedChatId={setSelectedChatId} />
        <ChatsSearchBar
          sx={{}}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
        />
      </Box>
      <ChatsList
        searchValue={searchValue}
        selectedChatId={selectedChatId}
        setSelectedChatId={setSelectedChatId}
      />
    </Box>
  );
}

export default Sidebar;
