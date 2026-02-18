import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogTitle,
  IconButton,
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
  const chatOptionsItemSx = {
    display: "flex",
    alignItems: "center",
    gap: 1.25,
    px: 1,
    py: 0.75,
    minHeight: 0,
    borderRadius: 1.25,
    "&:hover": {
      bgcolor: "action.hover",
    },
  };
  const chatOptionsIconSx = { color: "action.active", fontSize: "1.15rem" };
  const publicChatMembers =
    chat.type === "private"
      ? null
      : chat.members.map((member) => member.displayName).join(", ");
  const otherChatMember =
    chat.type === "private"
      ? chat.members.find((member) => member.uid !== user.uid) || null
      : null;
  const otherChatMemberUid = otherChatMember?.uid || null;
  const calleeStatus = otherChatMember
    ? userStatuses[otherChatMember.uid]
    : null;

  useEffect(() => {
    if (chat.type !== "private" || !otherChatMemberUid) return;
    if (callState.status === "Calling..." && calleeStatus === "online") {
      dispatch(setCall({ ...callState, status: "Ringing..." }));
      return;
    }
    if (callState.status === "Ringing..." && calleeStatus !== "online") {
      dispatch(setCall({ ...callState, status: "Calling..." }));
    }
  }, [calleeStatus, callState, chat.type, dispatch, otherChatMemberUid]);

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

  const renderChatOptionsItem = (IconComponent, label, onClick) => (
    <MenuItem onClick={onClick} sx={chatOptionsItemSx}>
      <IconComponent sx={chatOptionsIconSx} />
      <Typography variant="body2">{label}</Typography>
    </MenuItem>
  );

  const privateChatMenuItems = () => {
    return renderChatOptionsItem(DeleteIcon, "Delete", handleDeleteChatOpen);
  };

  const publicChatMenuItems = () => {
    return (
      <>
        {renderChatOptionsItem(
          GroupAddIcon,
          "Add members",
          handleAddPublicChatMembersOpen
        )}
        {renderChatOptionsItem(
          DriveFileRenameOutlineIcon,
          "Rename",
          handleRenamePublicChatOpen
        )}
        {chat.createdBy.uid === user.uid
          ? renderChatOptionsItem(DeleteIcon, "Delete", handleDeleteChatOpen)
          : renderChatOptionsItem(ExitToAppIcon, "Leave", handleLeaveChatOpen)}
      </>
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
    const readStateUpdates = {};

    handleAddPublicChatMembersClose();
    selectedMembers.forEach((member) => {
      unreadCounts[member.uid] = 0;
      readStateUpdates[`readState.${member.uid}.lastReadAt`] = null;
    });

    await updateDoc(doc(db, "chats", `${chat.chatId}`), {
      members: arrayUnion(...selectedMembers),
      memberIds: arrayUnion(...selectedMembers.map((member) => member.uid)),
      unreadCounts,
      ...readStateUpdates,
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
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
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
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Button onClick={() => makeCall(chat, true)}>
              <LocalPhoneOutlinedIcon />
            </Button>
            <Button onClick={() => makeCall(chat, false)}>
              <VideocamOutlinedIcon />
            </Button>
          </Box>
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
        PaperProps={{
          sx: {
            bgcolor: "background.paper",
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            minWidth: 140,
            p: 0.5,
          },
        }}
        MenuListProps={{ sx: { p: 0 } }}
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
