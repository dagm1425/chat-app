import React, { useState } from "react";
import PropTypes from "prop-types";
import UserDrawer from "./UserDrawer";
import ChatsList from "./ChatsList";
// import ChatsSearchBar from "./ChatsSearchBar";
import { Box } from "@mui/material";

function Sidebar({ selectedChatId, setSelectedChatId }) {
  const [searchValue, setSearchValue] = useState("");

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "23%",
        height: "100vh",
        borderRight: "2px solid",
        borderColor: "background.paper",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-evenly",
          py: "0.875rem",
          width: "100%",
        }}
      >
        <UserDrawer setSelectedChatId={setSelectedChatId} />
        <input
          type="text"
          value={searchValue}
          placeholder="Search chat"
          style={{
            padding: "0.5rem 1rem",
            width: "65%",
            border: "2px solid #eee",
            outline: "none",
            borderRadius: "30px",
            transition: "all 150ms ease-in",
          }}
          onChange={(e) => setSearchValue(e.target.value)}
          autoFocus
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

Sidebar.propTypes = {
  selectedChatId: PropTypes.string,
  setSelectedChatId: PropTypes.func,
};
