import React from "react";
import PropTypes from "prop-types";
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
      <Button color="error" onClick={deleteChat}>
        Delete
      </Button>

      <Button onClick={onClose}>Cancel</Button>
    </Box>
  );
}

export default DeleteChatDialogContent;

DeleteChatDialogContent.propTypes = {
  onClose: PropTypes.func,
  chatId: PropTypes.string,
};
