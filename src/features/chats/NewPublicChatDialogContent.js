import React, { useState } from "react";
import PropTypes from "prop-types";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import { useId } from "react";
import { Box, Button, TextField } from "@mui/material";

function NewPublicChatDialogContent({ onClose }) {
  const [chatName, setChatName] = useState("");
  const user = useSelector(selectUser);
  const chatId = useId();

  const createPublicChat = async () => {
    if (chatName === "") return;

    await setDoc(doc(db, "chats", `${chatId}`), {
      chatId: `${chatId}`,
      displayName: chatName,
      avatarBgColor: generateRandomColor(),
      type: "public",
      createdBy: user,
      members: [user],
      timestamp: serverTimestamp(),
      recentMsg: null,
      drafts: [],
      unreadCounts: { [user.uid]: 0 },
    });
  };

  const handleBtnClick = () => {
    createPublicChat();
    onClose();
  };

  const generateRandomColor = () => {
    let hex = Math.floor(Math.random() * 0xffffff);
    let color = "#" + hex.toString(16);

    return color;
  };

  return (
    <Box
      sx={{
        width: "340px",
        px: "1.5rem",
      }}
    >
      {/* <Typography
        variant="body1"
        sx={{ fontSize: "1rem", color: "text.secondary", mb: ".25rem" }}
      >
        Set a name for your group chat:
      </Typography> */}
      <TextField
        value={chatName}
        sx={{
          display: "block",
          fontSize: "16px",
          mb: "2rem",
        }}
        fullWidth
        onChange={(e) => setChatName(e.target.value)}
        autoFocus
        label="Group chat name"
        variant="standard"
        required
      />
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "0.5rem",
          pb: "1rem",
          pr: "1rem",
        }}
      >
        <Button onClick={handleBtnClick}>Create chat</Button>
        <Button onClick={onClose}>Cancel</Button>
      </Box>
    </Box>
  );
}

export default NewPublicChatDialogContent;

NewPublicChatDialogContent.propTypes = {
  setSelectedChatId: PropTypes.func,
  onClose: PropTypes.func,
};
