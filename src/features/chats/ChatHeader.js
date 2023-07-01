/* eslint-disable react/prop-types */
import React, { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { IconButton } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import DeleteIcon from "@mui/icons-material/Delete";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import DeleteChatDialogContent from "./DeleteChatDialogContent";
import AddPublicChatMembersDialogContent from "./AddPublicChatMembersDialogContent";
import RenamePublicChatDialogContent from "./RenamePublicChatDialogContent";
import LeaveChatDialogContent from "./LeaveChatDialogContent";

function ChatHeader({ chat }) {
  const user = useSelector(selectUser);
  const otherChatMember = chat.members.find(
    (member) => member.uid !== user.uid
  );
  const [anchorEl, setAnchorEl] = useState(null);
  const [isDeleteChatOpen, setIsDeleteChatOpen] = useState(false);
  const [isAddPublicChatMembersOpen, setIsAddPublicChatMembersOpen] =
    useState(false);
  const [isRenamePublicChatOpen, setIsRenamePublicChatOpen] = useState(false);
  const [isLeaveChatOpen, setIsLeaveChatOpen] = useState(false);

  const publicChatMembers =
    chat.type === " private"
      ? null
      : chat.members.map((member) => member.displayName).join(", ");

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

  // const otherChatMemberId = chat.members.find(
  //   (member) => member.uid !== user.uid
  // ).uid;
  // const [otherChatMember, setOtherChatMember] = useState({});

  // useEffect(() => {
  //   const unsub = onSnapshot(
  //     doc(db, "users", `${otherChatMemberId}`),
  //     (user) => {
  //       setOtherChatMember(user.data());
  //     }
  //   );

  //   return () => {
  //     unsub();
  //   };
  // }, []);

  return (
    <>
      <Box
        sx={{
          bgcolor: "header.main",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          p: "0.75rem",
        }}
      >
        <div>
          <Typography variant="h6">
            {chat.type === "private"
              ? otherChatMember.displayName
              : chat.displayName}
          </Typography>
          {chat.type === "private" ? (
            <Typography variant="subtitle1">
              {/* {otherChatMember.status === "online"
          ? "Online"
          : // <TimeAgo timestamp={otherChatMember.lastSeen} />
            otherChatMember.lastSeen} */}
              Last message at
            </Typography>
          ) : (
            <Typography
              variant="subtitle1"
              sx={{
                display: "block",
                whiteSpace: "nowrap" /* forces text to single line */,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {publicChatMembers}
            </Typography>
          )}
        </div>
        <IconButton onClick={handleChatOptionsOpen}>
          <MoreVertIcon />
        </IconButton>
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
        <DialogTitle>Confirm chat deletion</DialogTitle>
        <DeleteChatDialogContent
          onClose={handleDeleteChatClose}
          chatId={chat.chatId}
        />
      </Dialog>

      <Dialog
        open={isAddPublicChatMembersOpen}
        onClose={handleAddPublicChatMembersClose}
      >
        <DialogTitle>Add members</DialogTitle>
        <AddPublicChatMembersDialogContent
          onClose={handleAddPublicChatMembersClose}
          chat={chat}
        />
      </Dialog>

      <Dialog
        open={isRenamePublicChatOpen}
        onClose={handleRenamePublicChatClose}
      >
        <DialogTitle>Rename chat</DialogTitle>
        <RenamePublicChatDialogContent
          onClose={handleRenamePublicChatClose}
          chatId={chat.chatId}
        />
      </Dialog>

      <Dialog open={isLeaveChatOpen} onClose={handleLeaveChatClose}>
        <DialogTitle>Leave chat</DialogTitle>
        <LeaveChatDialogContent
          onClose={handleLeaveChatClose}
          chatId={chat.chatId}
          user={user}
        />
      </Dialog>
    </>
  );
}

export default ChatHeader;
