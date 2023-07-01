/* eslint-disable react/prop-types */
import React from "react";
import { db } from "../../firebase";
import { useNavigate } from "react-router-dom";
import { doc, deleteDoc } from "firebase/firestore";
import { Box, Button } from "@mui/material";

function DeleteChatDialogContent({ onClose, chatId }) {
  const navigate = useNavigate();

  const deleteChat = async () => {
    navigate("/");

    await deleteDoc(doc(db, "chats", `${chatId}`));
  };

  return (
    <Box>
      <Button onClick={deleteChat}>Delete</Button>
      <Button onClick={onClose}>Cancel</Button>
    </Box>
  );
}

export default DeleteChatDialogContent;
