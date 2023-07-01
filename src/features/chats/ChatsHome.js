import React from "react";
import { Box } from "@mui/material";
function ChatsHome() {
  return (
    <Box
      sx={{
        textAlign: "center",
        ml: "22%",
        width: "78%",
        bgcolor: "header.main",
        height: "100vh",
        display: "grid",
        placeItems: "center",
      }}
    >
      <h4
        style={{
          padding: "0.75rem",
          border: "1.25px solid grey",
          borderRadius: "25px",
          display: "inline-block",
        }}
      >
        Select a chat to start messaging
      </h4>
    </Box>
  );
}

export default ChatsHome;
