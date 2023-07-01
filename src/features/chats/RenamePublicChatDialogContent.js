/* eslint-disable react/prop-types */
import { Button } from "@mui/material";
import { doc, updateDoc } from "firebase/firestore";
import React, { useState } from "react";
import { db } from "../../firebase";

function RenamePublicChatDialogContent({ chatId, onClose }) {
  const [chatName, setChatName] = useState("");

  const handleChatRename = async () => {
    onClose();

    await updateDoc(doc(db, "chats", `${chatId}`), {
      displayName: chatName,
    });
  };

  return (
    <>
      <input
        type="text"
        autoFocus
        value={chatName}
        onChange={(e) => setChatName(e.target.value)}
      />
      <Button onClick={handleChatRename}>Rename chat</Button>
    </>
  );
}

export default RenamePublicChatDialogContent;
