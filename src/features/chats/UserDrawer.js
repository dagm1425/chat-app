/* eslint-disable react/prop-types */
import React, { useId, useState } from "react";
import { auth, db } from "../../firebase";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import {
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  Typography,
} from "@mui/material";
import Avatar from "@mui/material/Avatar";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import ContactsIcon from "@mui/icons-material/Contacts";
import ListItemIcon from "@mui/material/ListItemIcon";
import PeopleIcon from "@mui/icons-material/People";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import ListItemText from "@mui/material/ListItemText";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import { signOut } from "firebase/auth";
import NewPublicChatDialogContent from "./NewPublicChatDialogContent";
import UsersSearch from "./UsersSearch";
import SignOutDialogContent from "./SignOutDialogContent";
import { selectChats } from "./chatsSlice";
import { useNavigate } from "react-router-dom";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

function Userbar({ setSelectedChatId }) {
  const user = useSelector(selectUser);
  const chats = useSelector(selectChats);
  const chatId = useId();
  const navigate = useNavigate();

  const [isNewPrivateChatOpen, setIsNewPrivateChatOpen] = useState(false);
  const [isNewPublicChatOpen, setIsNewPublicChatOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);

  const signOutUser = async () => {
    signOut(auth);
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
    setIsSignOutOpen(true);
  };

  const createNewPrivateChat = async (otherChatMember) => {
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
    });

    setSelectedChatId(chatId);
    navigate(`/${chatId}`);
  };

  const handleItemClick = (otherChatMember) => {
    createNewPrivateChat(otherChatMember);
    handleNewPrivateChatClose();
  };

  return (
    <>
      <IconButton size="large" onClick={handleDrawerOpen}>
        <MenuIcon fontSize="large" />
      </IconButton>

      <Drawer anchor="left" open={isDrawerOpen} onClose={handleDrawerClose}>
        <Box
          sx={{
            width: 340,
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
              <ListItemButton onClick={handleNewPublicChatOpen}>
                <ListItemIcon>
                  <PeopleIcon />
                </ListItemIcon>
                <ListItemText primary="New group chat" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={handleNewPrivateChatOpen}>
                <ListItemIcon>
                  <ContactsIcon />
                </ListItemIcon>
                <ListItemText primary="Contacts" />
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
        <DialogTitle>Find users</DialogTitle>
        <UsersSearch
          excUsers={[user]}
          handleItemClick={handleItemClick}
          onClose={handleNewPrivateChatClose}
        />
      </Dialog>

      <Dialog open={isNewPublicChatOpen} onClose={handleNewPublicChatClose}>
        <DialogTitle>Set group chat name</DialogTitle>
        <NewPublicChatDialogContent
          setSelectedChatId={setSelectedChatId}
          onClose={handleNewPublicChatClose}
        />
      </Dialog>

      <Dialog open={isSignOutOpen} onClose={handleSignOutClose}>
        <DialogTitle>Sign out?</DialogTitle>
        <SignOutDialogContent
          signOutUser={signOutUser}
          onClose={handleSignOutClose}
        />
      </Dialog>
    </>
  );
}

export default Userbar;
