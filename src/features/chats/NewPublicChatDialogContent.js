import React, { useState } from "react";
import PropTypes from "prop-types";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import { v4 as uuid } from "uuid";
import { Box, Button, TextField, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import UsersSearch from "./UsersSearch";

function NewPublicChatDialogContent({
  onClose,
  setSelectedChatId,
  userStatuses,
}) {
  const [chatName, setChatName] = useState("");
  const [isCreatingPublicChat, setIsCreatingPublicChat] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const user = useSelector(selectUser);
  const navigate = useNavigate();

  const handleMemberSelect = (member) => {
    setSelectedMembers((prev) => {
      const selected = prev.find((item) => item.uid === member.uid);
      if (selected) return prev.filter((item) => item.uid !== member.uid);
      return [...prev, member];
    });
  };

  const createPublicChat = async () => {
    const trimmedChatName = chatName.trim();
    if (!trimmedChatName) return null;
    const chatId = uuid();
    const members = [user, ...selectedMembers];
    const uniqueMembers = Array.from(
      new Map(members.map((member) => [member.uid, member])).values()
    );
    const memberIds = uniqueMembers.map((member) => member.uid);
    const unreadCounts = memberIds.reduce((acc, uid) => {
      acc[uid] = 0;
      return acc;
    }, {});
    const readState = memberIds.reduce((acc, uid) => {
      acc[uid] = { lastReadAt: null };
      return acc;
    }, {});

    await setDoc(doc(db, "chats", `${chatId}`), {
      chatId: `${chatId}`,
      displayName: trimmedChatName,
      avatarBgColor: generateRandomColor(),
      type: "public",
      createdBy: user,
      members: uniqueMembers,
      memberIds,
      timestamp: serverTimestamp(),
      recentMsg: null,
      drafts: [],
      unreadCounts,
      readState,
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
        width: { xs: "92vw", sm: 360 },
        maxWidth: 360,
        px: "1.5rem",
        boxSizing: "border-box",
      }}
    >
      <TextField
        value={chatName}
        sx={{
          display: "block",
          fontSize: "16px",
          mb: "1rem",
          width: "100%",
        }}
        fullWidth
        onChange={(e) => setChatName(e.target.value)}
        autoFocus
        label="Group chat name"
        variant="standard"
        required
      />
      <Typography
        variant="body2"
        sx={{
          color: "text.secondary",
          mb: "0.5rem",
          width: "100%",
          textAlign: "left",
        }}
      >
        Add members
      </Typography>
      <UsersSearch
        excUsers={[user]}
        handleItemClick={handleMemberSelect}
        selectedMembers={selectedMembers}
        userStatuses={userStatuses}
        showFooterActions={false}
        isEmbedded
      />
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "0.5rem",
          pt: "0.75rem",
          pb: "0.5rem",
        }}
      >
        <Button
          disabled={isCreatingPublicChat || chatName.trim() === ""}
          onClick={handleBtnClick}
        >
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
  userStatuses: PropTypes.objectOf(PropTypes.string),
};
