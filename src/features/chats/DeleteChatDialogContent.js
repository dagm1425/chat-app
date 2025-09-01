import React from "react";
import PropTypes from "prop-types";
import { db } from "../../firebase";
import { useNavigate } from "react-router-dom";
import { doc, deleteDoc } from "firebase/firestore";
import { Box, Button, Typography } from "@mui/material";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";

function DeleteChatDialogContent({ onClose, chat }) {
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const chatId = chat.chatId;

  const deleteChat = async () => {
    navigate("/");

    await deleteDoc(doc(db, "chats", `${chatId}`));
  };

  const returnConfirmationMsg = () => {
    if (chat.type === "private") {
      const otherChatMember = chat.members.find(
        (member) => member.uid !== user.uid
      );
      return (
        "Are you sure you want to delete your chat with " +
        otherChatMember.displayName.replace(/ .*/, "") +
        "?"
      );
    } else {
      return "Are you sure you want to delete the group chat?";
    }
  };

  return (
    <Box
      sx={{
        width: 340,
        pb: "1rem",
        px: "1.5rem",
      }}
    >
      <Typography
        variant="body1"
        sx={{ fontSize: "1rem", color: "text.secondary", mb: ".75rem" }}
      >
        {returnConfirmationMsg()}
      </Typography>
      <Box
        sx={{
          width: "100%",
          display: "flex",
          justifyContent: "flex-end",
          gap: "0.5rem",
        }}
      >
        <Button color="error" onClick={deleteChat}>
          Delete
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </Box>
    </Box>
  );
}

export default DeleteChatDialogContent;

DeleteChatDialogContent.propTypes = {
  onClose: PropTypes.func,
  chat: PropTypes.object,
};
