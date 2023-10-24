/* eslint-disable react/prop-types */
import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Avatar,
  Box,
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

function ChatHeader({ chat, userStatuses }) {
  const user = useSelector(selectUser);
  const navigate = useNavigate();
  const otherChatMember = chat.members.find(
    (member) => member.uid !== user.uid
  );
  const [anchorEl, setAnchorEl] = useState(null);
  const [isDeleteChatOpen, setIsDeleteChatOpen] = useState(false);
  const [isAddPublicChatMembersOpen, setIsAddPublicChatMembersOpen] =
    useState(false);
  const [isRenamePublicChatOpen, setIsRenamePublicChatOpen] = useState(false);
  const [isLeaveChatOpen, setIsLeaveChatOpen] = useState(false);
  // const [recentMsg, setRecentMsg] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const publicChatMembers =
    chat.type === " private"
      ? null
      : chat.members.map((member) => member.displayName).join(", ");

  // useEffect(() => {
  //   const unsub = subscribeRecentMsg();

  //   return () => {
  //     unsub();
  //   };
  // }, [chatId]);

  // const subscribeRecentMsg = () => {
  //   const q = query(
  //     collection(db, "chats", `${chatId}`, "chatMessages"),
  //     orderBy("timestamp", "desc"),
  //     limit(1)
  //   );

  //   return onSnapshot(q, (querySnap) => {
  //     let recentMsg = [];
  //     querySnap.forEach((doc) => recentMsg.push(doc.data()));
  //     setRecentMsg(recentMsg[0]);
  //   });
  // };

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

    const unreadCounts = chat.unreadCounts;

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
        width: "78%",
        py: "0.75rem",
        zIndex: "1000",
        bgcolor: "background.default",
        borderBottom: "2px solid",
        // borderLeft: "2px solid",
        borderColor: "background.paper",
        "@media (max-width: 480px)": {
          width: "100%",
        },
      }}
    >
      <Box
        sx={{
          width: "95%",
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          "@media (max-width: 480px)": {
            gap: "0.75rem",
          },
        }}
      >
        <IconButton
          onClick={handleBack}
          sx={{
            display: "none",
            mb: "-6px",
            "@media (max-width: 480px)": {
              display: "block",
            },
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Box
          sx={{
            "@media (max-width: 480px)": {
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              mr: "auto",
            },
          }}
        >
          {chat.type === "private" ? (
            <Avatar
              src={otherChatMember.photoURL}
              sx={{
                display: "none",
                "@media (max-width: 480px)": {
                  display: "block",
                },
              }}
            />
          ) : (
            <Avatar
              sx={{
                display: "none",
                bgcolor: chat.avatarBgColor,
                "@media (max-width: 480px)": {
                  display: "block",
                },
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
                  display: "block",
                  width: "inherit",
                  whiteSpace: "nowrap" /* forces text to single line */,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {publicChatMembers}
              </Typography>
            )}
          </div>
        </Box>
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
        <DialogTitle sx={{ fontWeight: "normal" }}>
          {chat.type === "private"
            ? "Delete chat with " +
              otherChatMember.displayName.replace(/ .*/, "") +
              "?"
            : "Delete group chat?"}
        </DialogTitle>
        <DeleteChatDialogContent
          onClose={handleDeleteChatClose}
          chatId={chat.chatId}
        />
      </Dialog>

      <Dialog
        open={isAddPublicChatMembersOpen}
        onClose={handleAddPublicChatMembersClose}
      >
        <DialogTitle sx={{ fontWeight: "normal" }}>Add members</DialogTitle>
        <UsersSearch
          excUsers={chat.members}
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
};
