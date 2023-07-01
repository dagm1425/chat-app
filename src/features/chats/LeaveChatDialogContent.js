/* eslint-disable react/prop-types */
import React from "react";
import { db } from "../../firebase";
import { arrayRemove, doc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { Button } from "@mui/material";

function LeaveChatDialogContent({ chatId, user }) {
  const navigate = useNavigate();

  const handleLeaveChatClick = async () => {
    navigate("/");

    await updateDoc(doc(db, "chats", `${chatId}`), {
      members: arrayRemove(user),
    });
  };

  return <Button onClick={handleLeaveChatClick}>Leave</Button>;
}

export default LeaveChatDialogContent;
