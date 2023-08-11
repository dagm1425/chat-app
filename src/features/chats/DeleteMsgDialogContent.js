/* eslint-disable react/prop-types */
import React from "react";
import { db } from "../../firebase";
import { doc, deleteDoc } from "firebase/firestore";
import { Box, Button } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

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
