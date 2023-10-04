import React, { useState } from "react";
import PropTypes from "prop-types";
import { Box, Button, Input } from "@mui/material";
import { doc, updateDoc } from "firebase/firestore";
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
        autoFocus
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

RenamePublicChatDialogContent.propTypes = {
  chatId: PropTypes.string,
  onClose: PropTypes.func,
};
