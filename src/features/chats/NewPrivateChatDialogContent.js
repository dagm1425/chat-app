/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import ListItem from "@mui/material/ListItem";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Avatar from "@mui/material/Avatar";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import { selectChats } from "./chatsSlice";
import { doc, collection, setDoc, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { useId } from "react";

function NewPrivateChatDialogContent({ onClose }) {
  const user = useSelector(selectUser);
  const [users, setUsers] = useState([]);
  const chats = useSelector(selectChats);
  const [searchValue, setSearchValue] = useState("");
  const chatId = useId();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const users = [];

    const usersSnapshot = await getDocs(collection(db, "users"));
    usersSnapshot.forEach((user) => users.push(user.data()));
    setUsers(users);
  };

  const privateChats = chats.filter((chat) => chat.type === "private");

  const usersExcCurrentUser = (users) =>
    users.filter((otherUser) => otherUser.uid !== user.uid);

  const usersExcPrivateChatMembers = (users) => {
    return usersExcCurrentUser(users).filter((user) => {
      let userChats = privateChats.filter((chat) =>
        chat.members.find((member) => member.uid === user.uid)
      );

      if (userChats.length > 0) return false;
      return true;
    });
  };

  const filteredUsers = (users) => {
    if (searchValue === "") return usersExcPrivateChatMembers(users);

    const re = new RegExp(searchValue, "gi");

    return usersExcPrivateChatMembers(users).filter((user) => {
      return user.displayName.match(re);
    });
  };

  const createNewPrivateChat = async (otherChatMember) => {
    await setDoc(doc(db, "chats", `${chatId}`), {
      chatId: `${chatId}`,
      displayName: otherChatMember.displayName,
      photoURL: otherChatMember.photoURL,
      type: "private",
      createdBy: user,
      recentMsg: "You created this chat",
      members: [user, otherChatMember],
    });
  };

  const handleItemClick = (otherChatMember) => {
    createNewPrivateChat(otherChatMember);
    onClose();
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
    <>
      <input
        type="text"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
      />
      <List>{usersList}</List>
    </>
  );
}

export default NewPrivateChatDialogContent;
