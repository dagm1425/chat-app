/* eslint-disable react/prop-types */
import React from "react";
import { db } from "../../firebase";
import { useNavigate } from "react-router-dom";
import { doc, deleteDoc } from "firebase/firestore";
import { Box, Button } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

function DeleteChatDialogContent({ onClose, chatId }) {
  const navigate = useNavigate();

  const deleteChat = async () => {
    navigate("/");

    await deleteDoc(doc(db, "chats", `${chatId}`));
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
        onClick={deleteChat}
      >
        Delete
      </Button>

      <Button variant="outlined" onClick={onClose}>
        Cancel
      </Button>
    </Box>
  );
}

export default DeleteChatDialogContent;
