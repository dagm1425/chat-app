import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Input,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase";
import CircularProgress from "@mui/material/CircularProgress";
import UserStatus from "../user/UserStatus";

function UsersSearch({
  excUsers,
  handleItemClick,
  selectedMembers,
  addMembers,
  onClose,
  userStatuses,
  showFooterActions = true,
  isEmbedded = false,
}) {
  const [search, setSearch] = useState("");
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const isAddMembersFlow = Array.isArray(selectedMembers);

  useEffect(() => {
    const unsub = subscribeUsers();

    return () => {
      unsub();
    };
  }, []);

  const subscribeUsers = () => {
    const q = query(collection(db, "users"), orderBy("displayName"));

    return onSnapshot(q, (snapshot) => {
      const users = [];
      snapshot.forEach((doc) => {
        users.push(doc.data());
      });
      setUsers(users);
      setIsUsersLoading(false);
    });
  };

  const filteredUsers = () =>
    users.filter((otherUser) =>
      excUsers.find((excUser) => excUser.uid === otherUser.uid) ? false : true
    );

  const filteredUsersBySearch = () => {
    if (search === "") return filteredUsers();

    const re = new RegExp(search, "gi");

    return filteredUsers().filter((user) => {
      return user.displayName.match(re);
    });
  };

  const filteredResults = filteredUsersBySearch();
  const usersList = filteredResults.map((user) => {
    return (
      <ListItem key={user.uid} disablePadding>
        <ListItemButton onClick={() => handleItemClick(user)}>
          <ListItemAvatar>
            <Avatar src={user.photoURL} sx={{ position: "relative" }} />
            {isAddMembersFlow && (
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
          <ListItemText
            disableTypography
            primary={
              <Typography
                variant="body2"
                sx={{
                  display: "inline-block",
                  verticalAlign: "middle",
                }}
              >
                {user.displayName}
              </Typography>
            }
            secondary={<UserStatus status={userStatuses[user.uid]} />}
          />
        </ListItemButton>
      </ListItem>
    );
  });

  return (
    <Box
      sx={{
        textAlign: "center",
        width: isEmbedded ? "100%" : { xs: "92vw", sm: 360 },
        maxWidth: isEmbedded ? "100%" : 360,
        px: isEmbedded ? 0 : "1rem",
        boxSizing: "border-box",
      }}
    >
      <Input
        type="text"
        value={search}
        sx={{ fontSize: "18px", width: "100%", px: "6px" }}
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
      />
      {isAddMembersFlow && (
        <Box
          sx={{
            mt: "0.5rem",
            pb: selectedMembers.length ? "0.5rem" : 0,
            maxHeight: selectedMembers.length ? 76 : 0,
            overflowY: "auto",
            overflowX: "hidden",
            display: "flex",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "0.375rem",
            minWidth: 0,
            borderBottom: "1px solid",
            borderColor: selectedMembers.length ? "divider" : "transparent",
            transition: "max-height 220ms ease, padding-bottom 220ms ease",
          }}
        >
          {selectedMembers.map((member) => (
            <Chip
              key={member.uid}
              size="small"
              avatar={<Avatar src={member.photoURL} />}
              label={member.displayName}
              onDelete={() => handleItemClick(member)}
              sx={{
                maxWidth: "calc(50% - 3px)",
                "& .MuiChip-label": {
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                },
              }}
            />
          ))}
        </Box>
      )}
      <List
        sx={{
          height: 200,
          overflowY: "auto",
          width: "100%",
        }}
      >
        {!isUsersLoading ? (
          usersList.length ? (
            usersList
          ) : (
            <Box
              sx={{
                display: "grid",
                placeItems: "center",
                minHeight: "100%",
                px: "1rem",
                textAlign: "center",
              }}
            >
              <Typography variant="body1">
                {search.trim()
                  ? "No matching users found."
                  : isAddMembersFlow
                  ? "No new members found."
                  : "No users found."}
              </Typography>
            </Box>
          )
        ) : (
          <Box
            sx={{ display: "grid", placeItems: "center", minHeight: "100%" }}
          >
            <CircularProgress />
          </Box>
        )}
      </List>
      {showFooterActions && (
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
      )}
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
  userStatuses: PropTypes.objectOf(PropTypes.string),
  showFooterActions: PropTypes.bool,
  isEmbedded: PropTypes.bool,
};
