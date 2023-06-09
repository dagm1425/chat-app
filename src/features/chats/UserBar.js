/* eslint-disable react/prop-types */
import React, { useState } from "react";
import { auth } from "../../firebase";
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
import NewPrivateChatDialogContent from "./NewPrivateChatDialogContent";
import NewPublicChatDialogContent from "./NewPublicChatDialogContent";

function Userbar() {
  const user = useSelector(selectUser);
  const [isNewPrivateChatOpen, setIsNewPrivateChatOpen] = useState(false);
  const [isNewPublicChatOpen, setIsNewPublicChatOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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
    setIsNewPrivateChatOpen(true);
  };

  const handleNewPrivateChatClose = () => {
    setIsNewPrivateChatOpen(false);
  };

  const handleNewPublicChatOpen = () => {
    setIsNewPublicChatOpen(true);
  };

  const handleNewPublicChatClose = () => {
    setIsNewPublicChatOpen(false);
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
                <ListItemText primary="New Public Chat" />
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
          {/* <Divider /> */}

          <Button
            sx={{ py: "0.75rem" }}
            startIcon={<LogoutIcon />}
            color="error"
            onClick={signOutUser}
          >
            Sign Out
          </Button>
        </Box>
      </Drawer>

      <Dialog open={isNewPrivateChatOpen} onClose={handleNewPrivateChatClose}>
        <DialogTitle>Find Users</DialogTitle>
        <NewPrivateChatDialogContent onClose={handleNewPrivateChatClose} />
      </Dialog>

      <Dialog open={isNewPublicChatOpen} onClose={handleNewPublicChatClose}>
        <DialogTitle>Set Public Chat Name</DialogTitle>
        <NewPublicChatDialogContent onClose={handleNewPublicChatClose} />
      </Dialog>
    </>
  );
}

export default Userbar;
