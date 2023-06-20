/* eslint-disable react/prop-types */
import React, { useState } from "react";
import Button from "@mui/material/Button";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../../firebase";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";

function NewPublicChatDialogContent({ onClose }) {
  const [chatName, setChatName] = useState("");
  const user = useSelector(selectUser);

  const createPublicChat = async () => {
    await addDoc(collection(db, "chats"), {
      chatId: `p${user.uid}`,
      displayName: chatName,
      photoURL: user.photoURL,
      type: "public",
      createdBy: user,
      members: [user],
      recentMsg: "You created this chat",
    });
  };

  const handleBtnClick = () => {
    createPublicChat();
    onClose();
  };

  return (
    <>
      <input type="text" onChange={(e) => setChatName(e.target.value)} />
      <Button onClick={handleBtnClick}>Create chat</Button>
    </>
  );
}

export default NewPublicChatDialogContent;
