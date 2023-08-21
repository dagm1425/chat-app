/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Input,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

function UsersSearch({ excUsers, handleItemClick, addMembers, onClose }) {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const unsub = subscribeUsers();

    return () => {
      unsub();
    };
  }, []);

  const subscribeUsers = () => {
    return onSnapshot(collection(db, "users"), (snapshot) => {
      const users = [];
      snapshot.forEach((doc) => {
        users.push(doc.data());
      });
      setUsers(users);
    });
  };

  const filteredUsers = () =>
    users.filter((otherUser) =>
      excUsers.find((excUser) => excUser.uid === otherUser.uid) ? false : true
    );

  const filteredUsersBySearch = (users) => {
    if (search === "") return filteredUsers(users);

    const re = new RegExp(search, "gi");

    return filteredUsers(users).filter((user) => {
      return user.displayName.match(re);
    });
  };

  const usersList = filteredUsersBySearch(users).map((user) => {
    return (
      <ListItem key={user.uid} disableGutters>
        <ListItemButton autoFocus onClick={() => handleItemClick(user)}>
          <ListItemAvatar>
            <Avatar src={user.photoURL} />
          </ListItemAvatar>
          <ListItemText primary={user.displayName} />
        </ListItemButton>
      </ListItem>
    );
  });

  return (
    <Box sx={{ textAlign: "center" }}>
      <Input
        type="text"
        value={search}
        sx={{ fontSize: "18px", width: 280, mx: "1.25rem", px: "6px" }}
        onChange={(e) => setSearch(e.target.value)}
        startAdornment={
          <Box
            sx={{
              m: "8px 8px 8px 0",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SearchIcon />
          </Box>
        }
        inputRef={(input) => input && input.focus()}
      />
      <List>{usersList}</List>
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "0.5rem",
          pb: "1rem",
          pr: "1rem",
        }}
      >
        {addMembers && <Button onClick={addMembers}>Add Members</Button>}
        <Button onClick={onClose}>Cancel</Button>
      </Box>
    </Box>
  );
}

export default UsersSearch;
