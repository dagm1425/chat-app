import React from "react";
import { Box, Typography } from "@mui/material";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";

function ChatsHome() {
  return (
    <Box
      sx={{
        display: { xs: "none", sm: "grid" },
        ml: { xs: "0", sm: "35%", lg: "23%" },
        width: { xs: "100%", sm: "65%", lg: "77%" },
        bgcolor: " rgba(0,0,0,0.02)",
        height: "100vh",
        textAlign: "center",
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
