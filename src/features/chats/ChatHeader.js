import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogTitle,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import DeleteIcon from "@mui/icons-material/Delete";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LocalPhoneOutlinedIcon from "@mui/icons-material/LocalPhoneOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import DeleteChatDialogContent from "./DeleteChatDialogContent";
import RenamePublicChatDialogContent from "./RenamePublicChatDialogContent";
import LeaveChatDialogContent from "./LeaveChatDialogContent";
import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import UsersSearch from "./UsersSearch";
import UserStatus from "../user/UserStatus";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { selectCall, setCall } from "./chatsSlice";

function ChatHeader({ chat, userStatuses, makeCall }) {
  const user = useSelector(selectUser);
  const callState = useSelector(selectCall);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [anchorEl, setAnchorEl] = useState(null);
  const [isDeleteChatOpen, setIsDeleteChatOpen] = useState(false);
  const [isAddPublicChatMembersOpen, setIsAddPublicChatMembersOpen] =
    useState(false);
  const [isRenamePublicChatOpen, setIsRenamePublicChatOpen] = useState(false);
  const [isLeaveChatOpen, setIsLeaveChatOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const publicChatMembers =
    chat.type === "private"
      ? null
      : chat.members.map((member) => member.displayName).join(", ");
  const otherChatMember = chat.members.find(
    (member) => member.uid !== user.uid
  );
  const calleeStatus = userStatuses[otherChatMember.uid];

  useEffect(() => {
    if (calleeStatus === "online" && callState.status === "Calling...") {
      dispatch(setCall({ ...callState, status: "Ringing..." }));
    }
  }, [calleeStatus, callState.status]);

  const handleChatOptionsOpen = (e) => {
    setAnchorEl(e.currentTarget);
  };

  const handleChatOptionsClose = () => {
    setAnchorEl(null);
  };

  const handleDeleteChatOpen = () => {
    setAnchorEl(null);
    setIsDeleteChatOpen(true);
  };

  const handleDeleteChatClose = () => {
    setIsDeleteChatOpen(false);
  };

  const handleAddPublicChatMembersOpen = () => {
    setAnchorEl(null);
    setIsAddPublicChatMembersOpen(true);
  };

  const handleAddPublicChatMembersClose = () => {
    setIsAddPublicChatMembersOpen(false);
    setSelectedMembers([]);
  };

  const handleRenamePublicChatOpen = () => {
    setAnchorEl(null);
    setIsRenamePublicChatOpen(true);
  };

  const handleRenamePublicChatClose = () => {
    setIsRenamePublicChatOpen(false);
  };

  const handleLeaveChatOpen = () => {
    setAnchorEl(null);
    setIsLeaveChatOpen(true);
  };

  const handleLeaveChatClose = () => {
    setIsLeaveChatOpen(false);
  };

  const privateChatMenuItems = () => {
    return (
      <MenuItem onClick={handleDeleteChatOpen}>
        <ListItemIcon>
          <DeleteIcon />
        </ListItemIcon>
        <ListItemText primary="Delete" />
      </MenuItem>
    );
  };

  const publicChatMenuItems = () => {
    return (
      <Box>
        <MenuItem onClick={handleAddPublicChatMembersOpen}>
          <ListItemIcon>
            <GroupAddIcon />
          </ListItemIcon>
          <ListItemText primary="Add members" />
        </MenuItem>
        <MenuItem onClick={handleRenamePublicChatOpen}>
          <ListItemIcon>
            <DriveFileRenameOutlineIcon />
          </ListItemIcon>
          <ListItemText primary="Rename" />
        </MenuItem>
        {chat.createdBy.uid === user.uid ? (
          <MenuItem onClick={handleDeleteChatOpen}>
            <ListItemIcon>
              <DeleteIcon />
            </ListItemIcon>
            <ListItemText primary="Delete" />
          </MenuItem>
        ) : (
          <MenuItem onClick={handleLeaveChatOpen}>
            <ListItemIcon>
              <ExitToAppIcon />
            </ListItemIcon>
            <ListItemText primary="Leave" />
          </MenuItem>
        )}
      </Box>
    );
  };

  const MenuItems =
    chat.type === "private" ? privateChatMenuItems() : publicChatMenuItems();

  const handleItemClick = (user) => {
    let selections;

    if (!selectedMembers.length) {
      selections = [user];
    } else {
      const i = selectedMembers.indexOf(user);

      if (i !== -1) {
        selections = selectedMembers.slice();
        selections.splice(i, 1);
      } else selections = [...selectedMembers, user];
    }

    setSelectedMembers(selections);
  };

  const addMembers = async () => {
    if (!selectedMembers.length) return;

    const unreadCounts = { ...chat.unreadCounts };

    handleAddPublicChatMembersClose();
    selectedMembers.forEach((member) => {
      unreadCounts[member.uid] = 0;
    });

    await updateDoc(doc(db, "chats", `${chat.chatId}`), {
      members: arrayUnion(...selectedMembers),
      unreadCounts,
    });
  };

  const handleBack = () => {
    navigate("/");
  };

  return (
    <Box
      sx={{
        flex: "0 1 auto",
        position: "fixed",
        top: "0",
        width: { xs: "100%", sm: "71%", lg: "78%" },
        py: "0.75rem",
        zIndex: "1000",
        bgcolor: "background.default",
        borderBottom: "1.5px solid",
        borderColor: "background.paper",
      }}
    >
      <Box
        sx={{
          width: "95%",
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: { xs: "0.5rem", sm: "0" },
        }}
      >
        <IconButton
          onClick={handleBack}
          sx={{
            display: { xs: "block", sm: "none" },
            mb: "-6px",
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Box
          sx={{
            display: { xs: "flex", sm: "block" },
            alignItems: { xs: "center", sm: "initial" },
            gap: { xs: "0.75rem", sm: "0rem" },
            mr: { xs: "auto", sm: "initial" },
            width: { xs: "70%", sm: "auto" },
          }}
        >
          {chat.type === "private" ? (
            <Avatar
              src={otherChatMember.photoURL}
              sx={{
                display: { xs: "block", sm: "none" },
              }}
            />
          ) : (
            <Avatar
              sx={{
                display: { xs: "grid", sm: "none" },
                placeItems: { xs: "center" },
                bgcolor: chat.avatarBgColor,
              }}
            >
              {chat.displayName.charAt(0).toUpperCase()}
            </Avatar>
          )}
          <div>
            <Typography variant="body1" sx={{ fontWeight: "bold" }}>
              {chat.type === "private"
                ? otherChatMember.displayName
                : chat.displayName}
            </Typography>
            {chat.type === "private" ? (
              <UserStatus status={userStatuses[otherChatMember.uid]} />
            ) : (
              <Typography
                variant="body2"
                sx={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {publicChatMembers}
              </Typography>
            )}
          </div>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {chat.type === "private" && (
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Button onClick={() => makeCall(chat, true)}>
                <LocalPhoneOutlinedIcon />
              </Button>
              <Button onClick={() => makeCall(chat, false)}>
                <VideocamOutlinedIcon />
              </Button>
            </Box>
          )}
          <IconButton onClick={handleChatOptionsOpen}>
            <MoreVertIcon />
          </IconButton>
        </Box>
      </Box>

      <Menu
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handleChatOptionsClose}
      >
        {MenuItems}
      </Menu>

      <Dialog open={isDeleteChatOpen} onClose={handleDeleteChatClose}>
        <DialogTitle
          sx={{ fontSize: "1.1rem", fontWeight: "normal", px: "1.5rem" }}
        >
          Delete chat
        </DialogTitle>
        <DeleteChatDialogContent onClose={handleDeleteChatClose} chat={chat} />
      </Dialog>

      <Dialog
        open={isAddPublicChatMembersOpen}
        onClose={handleAddPublicChatMembersClose}
      >
        <DialogTitle sx={{ fontWeight: "normal" }}>Add members</DialogTitle>
        <UsersSearch
          excUsers={chat.members}
          userStatuses={userStatuses}
          handleItemClick={handleItemClick}
          selectedMembers={selectedMembers}
          addMembers={addMembers}
          onClose={handleAddPublicChatMembersClose}
        />
      </Dialog>

      <Dialog
        open={isRenamePublicChatOpen}
        onClose={handleRenamePublicChatClose}
        disableRestoreFocus
      >
        <DialogTitle sx={{ fontWeight: "normal" }}>Rename chat</DialogTitle>
        <RenamePublicChatDialogContent
          onClose={handleRenamePublicChatClose}
          chatId={chat.chatId}
        />
      </Dialog>

      <Dialog open={isLeaveChatOpen} onClose={handleLeaveChatClose}>
        <DialogTitle sx={{ fontWeight: "normal" }}>Leave chat?</DialogTitle>
        <LeaveChatDialogContent
          chatId={chat.chatId}
          user={user}
          onClose={handleLeaveChatClose}
        />
      </Dialog>
    </Box>
  );
}

export default ChatHeader;

ChatHeader.propTypes = {
  chat: PropTypes.object,
  userStatuses: PropTypes.objectOf(PropTypes.string),
  makeCall: PropTypes.func,
};
