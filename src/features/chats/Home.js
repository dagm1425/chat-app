import React, { useState } from "react";
import { auth } from "../../firebase";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import { Typography } from "@mui/material";
import Dialog from "@mui/material/Dialog";
import ListItem from "@mui/material/ListItem";
// import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import { signOut } from "firebase/auth";

function Home() {
  const user = useSelector(selectUser);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isNewPrivateChatOpen, setIsNewPrivateChatOpen] = useState(false);

  const signOutUser = () => {
    signOut(auth);
  };

  const handleNewChatOpen = () => {
    setIsNewChatOpen(true);
  };

  const handleNewChatClose = () => {
    setIsNewChatOpen(false);
  };

  const handleNewPrivateChatOpen = () => {
    // setIsNewChatOpen(false);
    setIsNewPrivateChatOpen(true);
  };

  const handleNewPrivateChatClose = () => {
    setIsNewPrivateChatOpen(false);
  };

  const usersExcCurrentUser =
  return (
    <Box>
      <Typography>{user.displayName}</Typography>
      <img src={user.photoURL} />
      <Button onClick={signOutUser}>Sign Out</Button>
      <Button onClick={handleNewChatOpen}>Create new chat</Button>

      <Dialog open={isNewChatOpen} onClose={handleNewChatClose}>
        <ListItem disableGutters>
          <ListItemButton autoFocus onClick={() => handleNewPrivateChatOpen()}>
            {/* <ListItemAvatar>
              <Avatar>
                <AddIcon />
              </Avatar>
            </ListItemAvatar> */}
            <ListItemText primary="New private chat" />
          </ListItemButton>
        </ListItem>
      </Dialog>

      <Dialog open={isNewPrivateChatOpen} onClose={handleNewPrivateChatClose}>
        <ListItem disableGutters>
          <ListItemButton
            autoFocus
            onClick={() => handleNewPrivateChatOpen("addAccount")}
          >
            {/* <ListItemAvatar>
              <Avatar>
                <AddIcon />
              </Avatar>
            </ListItemAvatar> */}
            <ListItemText primary="New private chat" />
          </ListItemButton>
        </ListItem>
      </Dialog>
    </Box>
  );
}

export default Home;
