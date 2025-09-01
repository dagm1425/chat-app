import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import UserDrawer from "./UserDrawer";
import ChatsList from "./ChatsList";
import { Box, useMediaQuery, TextareaAutosize, useTheme } from "@mui/material";
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
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.up("sm"));

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
        <TextareaAutosize
          style={{
            fontFamily: "inherit",
            fontSize: isSm ? "0.875rem" : "1rem",
            color: theme.palette.text.primary,
            backgroundColor: theme.palette.background.paper,
            padding: "0.625rem 1rem",
            width: "80%",
            borderRadius: "30px",
            border: "none",
            outline: "none",
            resize: "none",
          }}
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

Sidebar.propTypes = {
  selectedChatId: PropTypes.string,
  setSelectedChatId: PropTypes.func,
  userStatuses: PropTypes.objectOf(PropTypes.string),
  setUserStatus: PropTypes.func,
};
