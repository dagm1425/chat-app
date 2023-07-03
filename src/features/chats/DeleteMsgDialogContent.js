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
    <Box>
      <Button onClick={deleteMsg}>Delete</Button>
      <Button onClick={onClose}>Cancel</Button>
    </Box>
  );
}

export default DeleteMsgDialogContent;
