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
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import { signOut } from "firebase/auth";
import NewPublicChatDialogContent from "./NewPublicChatDialogContent";
import UsersSearch from "./UsersSearch";
import SignOutDialogContent from "./SignOutDialogContent";
import { selectChats } from "./chatsSlice";
import { useNavigate } from "react-router-dom";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { ColorModeContext } from "../..";
import { useTheme } from "@emotion/react";

function Userbar({ setSelectedChatId }) {
  const user = useSelector(selectUser);
  const chats = useSelector(selectChats);
  const navigate = useNavigate();
  const theme = useTheme();
  const [isNewPrivateChatOpen, setIsNewPrivateChatOpen] = useState(false);
  const [isNewPublicChatOpen, setIsNewPublicChatOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);
  const colorMode = React.useContext(ColorModeContext);

  const signOutUser = async () => {
    signOut(auth);
    localStorage.removeItem("auth");
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

  const createNewPrivateChat = async (otherChatMember) => {
    const chatId = uuid();

    const privateChats = chats.filter((chat) => chat.type === "private");

    const existingChat = privateChats.find((chat) =>
      chat.members.find((member) => member.uid === otherChatMember.uid)
    );

    if (existingChat) {
      setSelectedChatId(existingChat.chatId);
      navigate(`/${existingChat.chatId}`);
      return;
    }

    await setDoc(doc(db, "chats", `${chatId}`), {
      chatId: `${chatId}`,
      type: "private",
      createdBy: user,
      members: [user, otherChatMember],
      timestamp: serverTimestamp(),
      recentMsg: null,
      draft: null,
    });
  };

  const handleItemClick = (otherChatMember) => {
    createNewPrivateChat(otherChatMember);
    handleNewPrivateChatClose();
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
              <ListItemButton onClick={colorMode.toggleColorMode}>
                <ListItemIcon>
                  <Brightness4Icon />
                </ListItemIcon>
                <ListItemText primary="Dark mode" />
                <Switch checked={theme.palette.mode === "dark"} size="small" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding disabled>
              <ListItemButton>
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
        />
      </Dialog>

      <Dialog
        open={isNewPublicChatOpen}
        onClose={handleNewPublicChatClose}
        disableRestoreFocus
      >
        <DialogTitle sx={{ fontWeight: "normal" }}>
          Set group chat name
        </DialogTitle>
        <NewPublicChatDialogContent onClose={handleNewPublicChatClose} />
      </Dialog>

      <Dialog open={isSignOutOpen} onClose={handleSignOutClose}>
        <DialogTitle sx={{ fontWeight: "normal" }}>Sign out?</DialogTitle>
        <SignOutDialogContent
          signOutUser={signOutUser}
          onClose={handleSignOutClose}
        />
      </Dialog>
    </>
  );
}

export default Userbar;

Userbar.propTypes = {
  setSelectedChatId: PropTypes.func,
};
