import React, { useState } from "react";
import PropTypes from "prop-types";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import { v4 as uuid } from "uuid";
import { Box, Button, TextField } from "@mui/material";
import { useNavigate } from "react-router-dom";

function NewPublicChatDialogContent({ onClose, setSelectedChatId }) {
  const [chatName, setChatName] = useState("");
  const [isCreatingPublicChat, setIsCreatingPublicChat] = useState(false);
  const user = useSelector(selectUser);
  const navigate = useNavigate();

  const createPublicChat = async () => {
    const trimmedChatName = chatName.trim();
    if (!trimmedChatName) return null;
    const chatId = uuid();

    await setDoc(doc(db, "chats", `${chatId}`), {
      chatId: `${chatId}`,
      displayName: trimmedChatName,
      avatarBgColor: generateRandomColor(),
      type: "public",
      createdBy: user,
      members: [user],
      memberIds: [user.uid],
      timestamp: serverTimestamp(),
      recentMsg: null,
      drafts: [],
      unreadCounts: { [user.uid]: 0 },
      readState: {
        [user.uid]: { lastReadAt: null },
      },
    });

    setSelectedChatId(chatId);
    navigate(`/${chatId}`);
    return chatId;
  };

  const handleBtnClick = async () => {
    if (isCreatingPublicChat) return;
    setIsCreatingPublicChat(true);

    try {
      const createdChatId = await createPublicChat();
      if (createdChatId) onClose();
    } catch (error) {
      console.error(
        "[NewPublicChatDialogContent] Failed to create public chat:",
        error
      );
    } finally {
      setIsCreatingPublicChat(false);
    }
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
        <Button disabled={isCreatingPublicChat} onClick={handleBtnClick}>
          Create chat
        </Button>
        <Button disabled={isCreatingPublicChat} onClick={onClose}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
}

export default NewPublicChatDialogContent;

NewPublicChatDialogContent.propTypes = {
  setSelectedChatId: PropTypes.func,
  onClose: PropTypes.func,
};
