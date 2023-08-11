/* eslint-disable react/prop-types */
import React, { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
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
      photoURL: user.photoURL,
      type: "public",
      createdBy: user,
      members: [user],
    });
  };

  const handleBtnClick = () => {
    createPublicChat();
    onClose();
  };

  return (
    <Box
      sx={{
        textAlign: "center",
      }}
    >
      <Input
        type="text"
        value={chatName}
        sx={{
          display: "block",
          fontSize: "18px",
          width: 280,
          mx: "1.25rem",
          px: "6px",
        }}
        onChange={(e) => setChatName(e.target.value)}
        inputRef={(input) => input && input.focus()}
      />
      <Button
        variant="contained"
        sx={{ mb: "1.5rem", mt: "2.25rem" }}
        onClick={handleBtnClick}
      >
        Create chat
      </Button>
    </Box>
  );
}

export default NewPublicChatDialogContent;
