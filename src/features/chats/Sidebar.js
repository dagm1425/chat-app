import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import UserDrawer from "./UserDrawer";
import ChatsList from "./ChatsList";
import { Box, TextareaAutosize, useMediaQuery } from "@mui/material";
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
  const isMobile = useMediaQuery("(max-width:600px)");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isMobile && inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return !isMobile || (isMobile && location.pathname === "/") ? (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        width: { xs: "100%", sm: "30%", lg: "23%" },

        height: "100vh",
        overflow: {
          xs: location.pathname === "/" ? "auto" : "hidden",
          sm: "hidden",
        },
        borderRight: "1.5px solid",
        borderColor: "background.paper",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: {
            xs: "space-evenly",
            sm: "space-between",
            lg: "space-evenly",
          },
          py: "0.875rem",
          px: { xs: "0", sm: "0.25rem", lg: "0" },
          width: { xs: "100%", sm: "97%", lg: "100%" },
        }}
      >
        <UserDrawer
          setSelectedChatId={setSelectedChatId}
          setUserStatus={setUserStatus}
          userStatuses={userStatuses}
        />
        <StyledTextarea
          ref={inputRef}
          value={searchValue}
          placeholder="Search chat"
          maxRows={1}
          onChange={(e) => setSearchValue(e.target.value)}
        />
      </Box>
      <ChatsList
        searchValue={searchValue}
        selectedChatId={selectedChatId}
        setSelectedChatId={setSelectedChatId}
      />
    </Box>
  ) : null;
}

export default Sidebar;

const StyledTextarea = styled(TextareaAutosize)`
  font-family: inherit;
  font-size: 0.875rem;
  color: ${({ theme }) => theme.palette.text.primary};
  background-color: ${({ theme }) => theme.palette.background.paper};
  padding: 0.625rem 1rem;
  width: 80%;
  border-radius: 30px;
  border: none;
  outline: none;
  resize: none;

  ${({ theme }) => theme.breakpoints.down("xs")} {
    font-size: 1rem;
  }
`;

Sidebar.propTypes = {
  selectedChatId: PropTypes.string,
  setSelectedChatId: PropTypes.func,
  userStatuses: PropTypes.objectOf(PropTypes.string),
  setUserStatus: PropTypes.func,
};
