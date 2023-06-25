/* eslint-disable react/prop-types */
import React, { useState } from "react";
import Button from "@mui/material/Button";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import { useId } from "react";

function NewPublicChatDialogContent({ onClose }) {
  const [chatName, setChatName] = useState("");
  const user = useSelector(selectUser);
  const chatId = useId();

  const createPublicChat = async () => {
    await setDoc(doc(db, "chats", `${chatId}`), {
      chatId: `${chatId}`,
      displayName: chatName,
      photoURL: user.photoURL,
      type: "public",
      createdBy: user,
      members: [user],
      recentMsg: "You created this chat",
      messages: [],
    });
  };

  const handleBtnClick = () => {
    createPublicChat();
    onClose();
  };

  return (
    <>
      <input
        type="text"
        value={chatName}
        onChange={(e) => setChatName(e.target.value)}
      />
      <Button onClick={handleBtnClick}>Create chat</Button>
    </>
  );
}

export default NewPublicChatDialogContent;
