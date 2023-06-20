/* eslint-disable react/prop-types */
import React, { useState } from "react";
import { auth } from "../../firebase";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import { Typography } from "@mui/material";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import PersonIcon from "@mui/icons-material/Person";
import AddIcon from "@mui/icons-material/Add";
import PeopleIcon from "@mui/icons-material/People";
import ListItemText from "@mui/material/ListItemText";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import { signOut } from "firebase/auth";
import NewPrivateChatDialogContent from "./NewPrivateChatDialogContent";
import NewPublicChatDialogContent from "./NewPublicChatDialogContent";

function Userbar() {
  const user = useSelector(selectUser);
  const [anchorEl, setAnchorEl] = useState(null);
  const [isNewPrivateChatOpen, setIsNewPrivateChatOpen] = useState(false);
  const [isNewPublicChatOpen, setIsNewPublicChatOpen] = useState(false);

  const signOutUser = () => {
    signOut(auth);
  };

  const handleNewChatOpen = (e) => {
    setAnchorEl(e.currentTarget);
  };

  const handleNewChatClose = () => {
    setAnchorEl(null);
  };

  const handleNewPrivateChatOpen = () => {
    setAnchorEl(null);
    setIsNewPrivateChatOpen(true);
  };

  const handleNewPrivateChatClose = () => {
    setIsNewPrivateChatOpen(false);
  };

  const handleNewPublicChatOpen = () => {
    setAnchorEl(null);
    setIsNewPublicChatOpen(true);
  };

  const handleNewPublicChatClose = () => {
    setIsNewPublicChatOpen(false);
  };

  return (
    <>
      <Box
        sx={{
          display: "flex",
          gap: "8px",
        }}
      >
        <Typography>{user.displayName}</Typography>
        <Box component="img" src={user.photoURL} />
        <Button onClick={signOutUser}>Sign Out</Button>

        <IconButton onClick={handleNewChatOpen}>
          <AddIcon />
        </IconButton>
      </Box>

      <Menu
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handleNewChatClose}
      >
        <MenuItem onClick={handleNewPrivateChatOpen}>
          <ListItemIcon>
            <PersonIcon />
          </ListItemIcon>
          <ListItemText primary="Private" />
        </MenuItem>
        <MenuItem onClick={handleNewPublicChatOpen}>
          <ListItemIcon>
            <PeopleIcon />
          </ListItemIcon>
          <ListItemText primary="Public" />
        </MenuItem>
      </Menu>

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
