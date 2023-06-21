/* eslint-disable react/prop-types */
import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

function ChatHeader({ chat }) {
  return (
    <Box>
      <Typography>{chat.displayName}</Typography>
    </Box>
  );
}

export default ChatHeader;
