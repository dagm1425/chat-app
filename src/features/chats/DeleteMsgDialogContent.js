/* eslint-disable react/prop-types */
import React from "react";
import { db } from "../../firebase";
import { doc, deleteDoc, updateDoc } from "firebase/firestore";
import { Box, Button } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useSelector } from "react-redux";
import { selectChats } from "./chatsSlice";

function DeleteMsgDialogContent({ chatId, msgId, chatMsg, onClose }) {
  const chats = useSelector(selectChats);

  const deleteMsg = async () => {
    const chat = chats.find((chat) => chat.chatId === chatId);

    onClose();

    if (chat.recentMsg.msgId === msgId) {
      const lastMsg = chatMsg[chatMsg.length - 2];

      await updateDoc(doc(db, "chats", `${chatId}`), {
        recentMsg: lastMsg,
      });
    }

    await deleteDoc(doc(db, "chats", `${chatId}`, "chatMessages", `${msgId}`));
  };

  return (
    <Box
      sx={{
        display: "flex",
        width: 280,
        justifyContent: "space-around",
        my: "1.5rem",
      }}
    >
      <Button
        variant="contained"
        color="error"
        startIcon={<DeleteIcon />}
        onClick={deleteMsg}
      >
        Delete
      </Button>

      <Button variant="outlined" onClick={onClose}>
        Cancel
      </Button>
    </Box>
  );
}

export default DeleteMsgDialogContent;
