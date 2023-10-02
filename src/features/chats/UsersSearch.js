import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
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
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import CircularProgress from "@mui/material/CircularProgress";

function UsersSearch({
  excUsers,
  handleItemClick,
  selectedMembers,
  addMembers,
  onClose,
}) {
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
      <ListItem key={user.uid} disablePadding>
        <ListItemButton autoFocus onClick={() => handleItemClick(user)}>
          <ListItemAvatar>
            <Avatar src={user.photoURL} sx={{ position: "relative" }} />
            {selectedMembers && (
              <Box
                component="span"
                sx={{
                  position: "absolute",
                  top: "1.75rem",
                  left: "2.5rem",
                  height: "1.5rem",
                  width: "1.5rem",
                  borderRadius: "50%",
                  border: "2px solid white",
                  backgroundColor: "primary.main",
                  transform: selectedMembers.find(
                    (member) => member.uid === user.uid
                  )
                    ? "scale(1)"
                    : "scale(0)",
                  transition: "transform 200ms ease-in-out",

                  "&:before": {
                    content: '""',
                    position: "absolute",
                    top: "0.65rem",
                    left: "0.25rem",
                    borderRight: "2px solid transparent",
                    borderBottom: "2px solid transparent",
                    transform: "rotate(45deg)",
                    transformOrigin: "0% 100%",
                    animation: selectedMembers.find(
                      (member) => member.uid === user.uid
                    )
                      ? "checkbox-check 100ms 200ms cubic-bezier(.4,.0,.23,1) forwards"
                      : "none",
                  },

                  "@keyframes checkbox-check": {
                    "0%": {
                      width: 0,
                      height: 0,
                      borderColor: "white",
                      transform: "translate3d(0,0,0) rotate(45deg)",
                    },
                    "33%": {
                      width: "0.375rem",
                      height: 0,
                      transform: "translate3d(0,0,0) rotate(45deg)",
                    },
                    "100%": {
                      width: "0.375rem",
                      height: "0.75rem",
                      borderColor: "white",
                      transform: "translate3d(0,-.75rem,0) rotate(45deg)",
                    },
                  },
                }}
              ></Box>
            )}
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
      {selectedMembers && (
        <Box
          sx={{
            display: "grid",
            gridTemplateRows: selectedMembers.length ? "1fr" : "0fr",
            mt: "0.5rem",
            transition: "grid-template-rows 250ms ease-in-out",
          }}
        >
          <Box sx={{ overflow: "hidden" }}>
            {selectedMembers.length > 0 &&
              selectedMembers.map((member) => {
                return (
                  <Box
                    key={member.uid}
                    sx={{
                      display: "inline-flex",
                      gap: "0.25rem",
                      mr: "0.25rem",
                      border: "none",
                      borderRadius: "30px",
                      backgroundColor: "primary.main",
                    }}
                  >
                    <Avatar
                      src={member.photoURL}
                      sx={{ width: 24, height: 24 }}
                    />
                    <Typography
                      variant="body2"
                      component="span"
                      sx={{ color: "white", pr: "0.5rem" }}
                    >
                      {member.displayName}
                    </Typography>
                  </Box>
                );
              })}
          </Box>
        </Box>
      )}
      <List
        sx={{
          display: "grid",
          placeItems: "center",
          height: 200,
          overflowY: "auto",
        }}
      >
        {usersList.length ? (
          <Box sx={{ width: "100%", height: "100%" }}>{usersList}</Box>
        ) : (
          <CircularProgress />
        )}
      </List>
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

UsersSearch.propTypes = {
  excUsers: PropTypes.arrayOf(
    PropTypes.PropTypes.shape({
      uid: PropTypes.string,
      displayName: PropTypes.string,
      photoURL: PropTypes.string,
    })
  ),
  handleItemClick: PropTypes.func,
  selectedMembers: PropTypes.arrayOf(
    PropTypes.PropTypes.shape({
      uid: PropTypes.string,
      displayName: PropTypes.string,
      photoURL: PropTypes.string,
    })
  ),
  addMembers: PropTypes.func,
  onClose: PropTypes.func,
};
