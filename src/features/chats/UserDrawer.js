import React, { useState } from "react";
import PropTypes from "prop-types";
import { auth, db } from "../../firebase";
import { v4 as uuid } from "uuid";
import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Typography,
  Avatar,
  DialogTitle,
  Dialog,
  Switch,
} from "@mui/material";
import ContactsIcon from "@mui/icons-material/Contacts";
import ListItemIcon from "@mui/material/ListItemIcon";
import PeopleIcon from "@mui/icons-material/People";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import SettingsIcon from "@mui/icons-material/Settings";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import CallIcon from "@mui/icons-material/Call";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import { signOut } from "firebase/auth";
import NewPublicChatDialogContent from "./NewPublicChatDialogContent";
import UsersSearch from "./UsersSearch";
import SignOutDialogContent from "./SignOutDialogContent";
import { selectChats } from "./chatsSlice";
import { useNavigate } from "react-router-dom";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { ColorModeContext } from "../../common/theme/ColorModeContext";
import { useTheme } from "@emotion/react";
import UserSettingsDialogContent from "../user/UserSettingsDialogContent";
import CallsHistoryDialogContent from "./CallsHistoryDialogContent";

function UserDrawer({
  setSelectedChatId,
  userStatuses,
  setUserStatus,
  startCall,
}) {
  const user = useSelector(selectUser);
  const chats = useSelector(selectChats);
  const navigate = useNavigate();
  const theme = useTheme();
  const [isNewPrivateChatOpen, setIsNewPrivateChatOpen] = useState(false);
  const [isNewPublicChatOpen, setIsNewPublicChatOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCallsOpen, setIsCallsOpen] = useState(false);
  const [isCreatingPrivateChat, setIsCreatingPrivateChat] = useState(false);
  const colorMode = React.useContext(ColorModeContext);

  const signOutUser = async () => {
    signOut(auth);
    localStorage.removeItem("auth");
    setUserStatus(user.uid, false);
  };

  const handleDrawerOpen = () => {
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
  };

  const handleNewPrivateChatOpen = () => {
    setIsDrawerOpen(false);
    setIsNewPrivateChatOpen(true);
  };

  const handleNewPrivateChatClose = () => {
    setIsNewPrivateChatOpen(false);
  };

  const handleNewPublicChatOpen = () => {
    setIsDrawerOpen(false);
    setIsNewPublicChatOpen(true);
  };

  const handleNewPublicChatClose = () => {
    setIsNewPublicChatOpen(false);
  };

  const handleSignOutClose = () => {
    setIsSignOutOpen(false);
  };

  const handleSignOutOpen = () => {
    setIsDrawerOpen(false);
    setIsSignOutOpen(true);
  };

  const handleSettingsOpen = () => {
    setIsDrawerOpen(false);
    setIsSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    setIsSettingsOpen(false);
  };

  const handleCallsOpen = () => {
    setIsDrawerOpen(false);
    setIsCallsOpen(true);
  };

  const handleCallsClose = () => {
    setIsCallsOpen(false);
  };

  const createNewPrivateChat = async (otherChatMember) => {
    const chatId = uuid();

    const privateChats = chats.filter((chat) => chat.type === "private");

    const existingChat = privateChats.find((chat) =>
      chat.members.find((member) => member.uid === otherChatMember.uid)
    );

    if (existingChat) {
      setSelectedChatId(existingChat.chatId);
      navigate(`/${existingChat.chatId}`);
      return existingChat.chatId;
    }

    await setDoc(doc(db, "chats", `${chatId}`), {
      chatId: `${chatId}`,
      type: "private",
      createdBy: user,
      members: [user, otherChatMember],
      memberIds: [user.uid, otherChatMember.uid],
      timestamp: serverTimestamp(),
      recentMsg: null,
      drafts: [],
      unreadCounts: { [user.uid]: 0, [otherChatMember.uid]: 0 },
      readState: {
        [user.uid]: { lastReadAt: null },
        [otherChatMember.uid]: { lastReadAt: null },
      },
    });

    setSelectedChatId(chatId);
    navigate(`/${chatId}`);
    return chatId;
  };

  const handleItemClick = async (otherChatMember) => {
    if (isCreatingPrivateChat) return;
    setIsCreatingPrivateChat(true);

    try {
      await createNewPrivateChat(otherChatMember);
      handleNewPrivateChatClose();
    } catch (error) {
      console.error("[UserDrawer] Failed to create private chat:", error);
    } finally {
      setIsCreatingPrivateChat(false);
    }
  };

  return (
    <>
      <IconButton
        size="medium"
        sx={{
          "&.MuiButtonBase-root:hover": {
            bgcolor: "transparent",
          },
        }}
        onClick={handleDrawerOpen}
      >
        <MenuIcon fontSize="medium" />
      </IconButton>

      <Drawer anchor="left" open={isDrawerOpen} onClose={handleDrawerClose}>
        <Box
          sx={{
            width: 290,
            role: "presentation",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box sx={{ margin: "1.5rem", textAlign: "center" }}>
            <Avatar
              sx={{
                display: "inline-block",
                width: 56,
                height: 56,
                mb: "0.5rem",
              }}
              src={user.photoURL}
            />
            <Typography>{user.displayName}</Typography>
          </Box>
          <Divider />

          <List sx={{ mb: "1rem" }}>
            <ListItem disablePadding>
              <ListItemButton onClick={handleNewPrivateChatOpen}>
                <ListItemIcon>
                  <ContactsIcon />
                </ListItemIcon>
                <ListItemText primary="Contacts" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={handleNewPublicChatOpen}>
                <ListItemIcon>
                  <PeopleIcon />
                </ListItemIcon>
                <ListItemText primary="New group chat" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={handleCallsOpen}>
                <ListItemIcon>
                  <CallIcon />
                </ListItemIcon>
                <ListItemText primary="Calls" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={colorMode.toggleColorMode}>
                <ListItemIcon>
                  <Brightness4Icon />
                </ListItemIcon>
                <ListItemText primary="Dark mode" />
                <Switch checked={theme.palette.mode === "dark"} size="small" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={handleSettingsOpen}>
                <ListItemIcon>
                  <SettingsIcon />
                </ListItemIcon>
                <ListItemText primary="Settings" />
              </ListItemButton>
            </ListItem>
          </List>
          <Button
            variant="outlined"
            sx={{ p: "0.5rem 1.25rem", alignSelf: "center" }}
            startIcon={<LogoutIcon />}
            color="error"
            onClick={handleSignOutOpen}
          >
            Sign Out
          </Button>
        </Box>
      </Drawer>

      <Dialog open={isNewPrivateChatOpen} onClose={handleNewPrivateChatClose}>
        <DialogTitle sx={{ fontWeight: "normal" }}>Find users</DialogTitle>
        <UsersSearch
          excUsers={[user]}
          handleItemClick={handleItemClick}
          onClose={handleNewPrivateChatClose}
          userStatuses={userStatuses}
        />
      </Dialog>

      <Dialog
        open={isNewPublicChatOpen}
        onClose={handleNewPublicChatClose}
        disableRestoreFocus
      >
        <DialogTitle
          sx={{
            fontSize: "1.1rem",
            fontWeight: "normal",
            px: "1.5rem",
            pb: "0.6rem",
          }}
        >
          New group chat
        </DialogTitle>
        <NewPublicChatDialogContent
          onClose={handleNewPublicChatClose}
          setSelectedChatId={setSelectedChatId}
          userStatuses={userStatuses}
        />
      </Dialog>

      <Dialog open={isSignOutOpen} onClose={handleSignOutClose}>
        <DialogTitle
          sx={{ fontSize: "1.1rem", fontWeight: "normal", px: "1.5rem" }}
        >
          Sign out
        </DialogTitle>
        <SignOutDialogContent
          signOutUser={signOutUser}
          onClose={handleSignOutClose}
        />
      </Dialog>

      <Dialog open={isSettingsOpen} onClose={handleSettingsClose}>
        <DialogTitle
          sx={{ fontSize: "1.1rem", fontWeight: "normal", px: "1.5rem" }}
        >
          Profile Settings
        </DialogTitle>
        <UserSettingsDialogContent onClose={handleSettingsClose} />
      </Dialog>

      <Dialog open={isCallsOpen} onClose={handleCallsClose}>
        <DialogTitle
          sx={{
            fontSize: "1.1rem",
            fontWeight: "normal",
            px: "1.05rem",
            pt: "0.875rem",
            pb: "0.35rem",
          }}
        >
          Calls
        </DialogTitle>
        <CallsHistoryDialogContent
          onClose={handleCallsClose}
          startCall={startCall}
        />
      </Dialog>
    </>
  );
}

export default UserDrawer;

UserDrawer.propTypes = {
  setSelectedChatId: PropTypes.func,
  userStatuses: PropTypes.objectOf(PropTypes.string),
  setUserStatus: PropTypes.func,
  startCall: PropTypes.func.isRequired,
};
