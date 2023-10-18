import React from "react";
import { Box, Typography } from "@mui/material";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";

function ChatsHome() {
  return (
    <Box
      sx={{
        ml: "23%",
        width: "77%",
        bgcolor: " rgba(0,0,0,0.02)",
        height: "100vh",
        textAlign: "center",
        display: "grid",
        placeItems: "center",
        "@media (max-width: 480px)": {
          display: "none",
        },
      }}
    >
      <div>
        <QuestionAnswerIcon
          sx={{ color: "text.secondary", fontSize: "4rem", opacity: "0.5" }}
        />
        <Typography
          variant="subtitle1"
          sx={{ fontSize: "1.25em", mt: "0.25rem" }}
        >
          ChatApp
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Create or select a chat to start messaging.
        </Typography>
      </div>
    </Box>
  );
}

export default ChatsHome;
