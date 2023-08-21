/* eslint-disable react/prop-types */
import React from "react";
import { db } from "../../firebase";
import { arrayRemove, doc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { Box, Button } from "@mui/material";

function LeaveChatDialogContent({ chatId, user, onClose }) {
  const navigate = useNavigate();

  const handleLeaveChatClick = async () => {
    navigate("/");

    await updateDoc(doc(db, "chats", `${chatId}`), {
      members: arrayRemove(user),
    });
  };

  return (
    <Box
      sx={{
        display: "flex",
        width: 280,
        justifyContent: "flex-end",
        mt: "1.5rem",
        pb: "1rem",
        pr: "1rem",
        gap: "0.5rem",
      }}
    >
      <Button onClick={handleLeaveChatClick}>Leave</Button>

      <Button onClick={onClose}>Cancel</Button>
    </Box>
  );
}

export default LeaveChatDialogContent;
