import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { off, onValue, ref } from "firebase/database";
import { rtDb } from "../../firebase";
import { Typography } from "@mui/material";
import { formatDistance } from "date-fns";

const UserStatus = ({ userId }) => {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const userStatusRef = ref(rtDb, "status/" + userId);
    onValue(userStatusRef, (snapshot) => {
      const value = snapshot.val();
      if (value === "online") {
        setStatus("online");
      } else {
        const lastSeen = formatDistance(new Date(value), new Date(), {
          addSuffix: true,
        });
        setStatus(`last seen ${lastSeen}`);
      }
    });

    return () => {
      off(userStatusRef);
    };
  }, [userId]);

  return (
    <Typography
      variant="body2"
      sx={{ color: status === "Online" ? "primary.main" : "text.secondary" }}
    >
      {status}
    </Typography>
  );
};

export default UserStatus;

UserStatus.propTypes = {
  userId: PropTypes.string,
};
