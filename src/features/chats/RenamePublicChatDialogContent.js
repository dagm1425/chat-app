/* eslint-disable react/prop-types */
import { Box, Button, Input } from "@mui/material";
import { doc, updateDoc } from "firebase/firestore";
import React, { useState } from "react";
import { db } from "../../firebase";

function RenamePublicChatDialogContent({ chatId, onClose }) {
  const [chatName, setChatName] = useState("");

  const handleChatRename = async () => {
    if (chatName === "") return;

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

      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "0.5rem",
          mt: "1.75rem",
          pb: "1rem",
          pr: "1rem",
        }}
      >
        <Button onClick={handleChatRename}>Rename</Button>
        <Button onClick={onClose}>Cancel</Button>
      </Box>
    </Box>
  );
}

export default RenamePublicChatDialogContent;
