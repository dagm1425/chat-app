/* eslint-disable react/prop-types */
import React from "react";
import { db } from "../../firebase";
import { doc, deleteDoc } from "firebase/firestore";
import { Box, Button } from "@mui/material";

function DeleteMsgDialogContent({ chatId, msgId, onClose }) {
  const deleteMsg = async () => {
    onClose();

    await deleteDoc(doc(db, "chats", `${chatId}`, "chatMessages", `${msgId}`));
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
      <Button color="error" onClick={deleteMsg}>
        Delete
      </Button>

      <Button onClick={onClose}>Cancel</Button>
    </Box>
  );
}

export default DeleteMsgDialogContent;
