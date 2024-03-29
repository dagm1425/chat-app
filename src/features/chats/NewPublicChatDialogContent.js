import React, { useState } from "react";
import PropTypes from "prop-types";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import { useId } from "react";
import { Box, Input, Button } from "@mui/material";

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
        textAlign: "center",
      }}
    >
      <Input
        value={chatName}
        sx={{
          display: "block",
          fontSize: "18px",
          width: 280,
          mx: "1.25rem",
          px: "6px",
        }}
        onChange={(e) => setChatName(e.target.value)}
        autoFocus
      />
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "0.5rem",
          mt: "1.75rem",
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
