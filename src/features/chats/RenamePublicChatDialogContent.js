/* eslint-disable react/prop-types */
import { Box, Button, Input } from "@mui/material";
import { doc, updateDoc } from "firebase/firestore";
import React, { useState } from "react";
import { db } from "../../firebase";

function RenamePublicChatDialogContent({ chatId, onClose }) {
  const [chatName, setChatName] = useState("");

  const handleChatRename = async () => {
    onClose();

    await updateDoc(doc(db, "chats", `${chatId}`), {
      displayName: chatName,
    });
  };

  return (
    <Box sx={{ textAlign: "center" }}>
      <Input
        type="text"
        value={chatName}
        sx={{
          fontSize: "18px",
          width: 280,
          mx: "1.25rem",
          display: "block",
          px: "6px",
        }}
        onChange={(e) => setChatName(e.target.value)}
        inputRef={(input) => input && input.focus()}
      />

      <Button
        variant="contained"
        sx={{ mb: "1.5rem", mt: "2.25rem" }}
        onClick={handleChatRename}
      >
        Rename chat
      </Button>
    </Box>
  );
}

export default RenamePublicChatDialogContent;
