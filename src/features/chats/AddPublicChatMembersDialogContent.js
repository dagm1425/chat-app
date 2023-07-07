/* eslint-disable react/prop-types */
import {
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import React, { useState, useEffect } from "react";
import { db } from "../../firebase";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import {
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Box,
} from "@mui/material";
import UsersSearchBar from "./UsersSearchBar";

function AddPublicChatMembersDialogContent({ chat, onClose }) {
  const user = useSelector(selectUser);
  const [searchValue, setSearchValue] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);

  useEffect(() => {
    // fetchUsers();
    const unsub = subscribeUsers();

    return () => {
      unsub();
    };
  }, []);

  // const fetchUsers = async () => {
  //   const users = [];

  //   const usersSnapshot = await getDocs(collection(db, "users"));
  //   usersSnapshot.forEach((user) => users.push(user.data()));
  //   setUsers(users);
  // };

  const subscribeUsers = () => {
    return onSnapshot(collection(db, "users"), (snapshot) => {
      const users = [];
      snapshot.forEach((doc) => {
        users.push(doc.data());
      });
      setUsers(users);
    });
  };

  const usersExcCurrentUser = (users) =>
    users.filter((otherUser) => otherUser.uid !== user.uid);

  const usersExcPublicChatMembers = (users) => {
    return usersExcCurrentUser(users).filter((user) => {
      return chat.members.find((member) => member.uid === user.uid)
        ? false
        : true;
    });
  };

  const filteredUsers = (users) => {
    if (searchValue === "") return usersExcPublicChatMembers(users);

    const re = new RegExp(searchValue, "gi");

    return usersExcPublicChatMembers(users).filter((user) => {
      return user.displayName.match(re);
    });
  };

  const handleItemClick = (user) => {
    let selections;

    if (!selectedMembers.length) {
      selections = [user];
    } else {
      const i = selectedMembers.indexOf(user);

      if (i !== -1) {
        selections = selectedMembers.slice().splice(i + 1, 1);
      } else selections = [...selectedMembers, user];
    }

    setSelectedMembers(selections);
  };

  const addMembers = async () => {
    if (!selectedMembers.length) return onClose();

    onClose();

    await updateDoc(doc(db, "chats", `${chat.chatId}`), {
      members: arrayUnion(...selectedMembers),
    });
  };

  const usersList = filteredUsers(users).map((user) => {
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
      <UsersSearchBar value={searchValue} setSearchValue={setSearchValue} />
      <List>{usersList}</List>
      <Button
        variant="contained"
        sx={{ mb: "1.5rem", mt: "2.25rem" }}
        onClick={addMembers}
      >
        Add Members
      </Button>
    </Box>
  );
}

export default AddPublicChatMembersDialogContent;
