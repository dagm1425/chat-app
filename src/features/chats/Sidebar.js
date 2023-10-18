import React, { useState } from "react";
import PropTypes from "prop-types";
import UserDrawer from "./UserDrawer";
import ChatsList from "./ChatsList";
// import ChatsSearchBar from "./ChatsSearchBar";
import { Box, TextareaAutosize } from "@mui/material";
import styled from "styled-components";
import { useLocation } from "react-router-dom";

function Sidebar({
  selectedChatId,
  setSelectedChatId,
  userStatuses,
  setUserStatus,
}) {
  const [searchValue, setSearchValue] = useState("");
  const location = useLocation();

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "23%",
        height: "100vh",
        borderRight: "1.5px solid",
        borderColor: "background.paper",
        "@media (max-width: 480px)": {
          width: location.pathname === "/" ? "100%" : "0",
          overflow: location.pathname === "/" ? "auto" : "hidden",
        },
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
        <UserDrawer
          setSelectedChatId={setSelectedChatId}
          setUserStatus={setUserStatus}
          userStatuses={userStatuses}
        />
        <StyledTextarea
          value={searchValue}
          placeholder="Search chat"
          maxRows={1}
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

const StyledTextarea = styled(TextareaAutosize)`
  font-family: inherit;
  font-size: 0.875rem;
  color: ${({ theme }) => theme.palette.text.primary};
  background-color: ${({ theme }) => theme.palette.background.paper};
  padding: 0.625rem 1rem;
  width: 75%;
  border-radius: 30px;
  border: none;
  outline: none;
  resize: none;
`;

Sidebar.propTypes = {
  selectedChatId: PropTypes.string,
  setSelectedChatId: PropTypes.func,
  userStatuses: PropTypes.objectOf(PropTypes.string),
  setUserStatus: PropTypes.func,
};
