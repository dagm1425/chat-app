import PropTypes from "prop-types";
import { Box, Typography } from "@mui/material";
import LocalPhoneIcon from "@mui/icons-material/LocalPhone";
import PhoneMissedIcon from "@mui/icons-material/PhoneMissed";
import PhoneCallbackIcon from "@mui/icons-material/PhoneCallback";
import MissedVideoCallIcon from "@mui/icons-material/MissedVideoCall";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";

const CallMsg = ({ message, makeCall }) => {
  const user = useSelector(selectUser);
  const status = message.callData.status
    ? message.callData.status[user.uid]
    : undefined;

  const chat = message.callData.chat;
  const isVideoCall = message.callData.isVideoCall;
  const isUserCaller = user.uid === message.from.uid;
  let callSummary;
  let icon = null;
  let label = "";
  const iconSize = "1.375rem";

  // if (status && status.startsWith("Outgoing call")) {
  //   icon = <CallMade sx={{ color: "green" }} />; // ↗ arrow
  //   label = status;
  //   duration = message.callData.duration;
  // } else if (status && status.startsWith("Incoming call")) {
  //   icon = <CallReceived sx={{ color: "green" }} />; // ↙ arrow
  //   label = status;
  // } else {
  switch (status) {
    case "Outgoing call":
      icon = isVideoCall ? (
        <VideoCallIcon sx={{ color: "gray[700]", fontSize: iconSize }} />
      ) : (
        <LocalPhoneIcon sx={{ color: "gray[700]", fontSize: iconSize }} />
      );
      label = "Outgoing call";
      callSummary = message.callData.duration;
      break;
    case "Incoming call":
      icon = isVideoCall ? (
        <VideoCallIcon sx={{ color: "gray[700]", fontSize: iconSize }} />
      ) : (
        <PhoneCallbackIcon sx={{ color: "gray[700]", fontSize: iconSize }} />
      );
      label = "Incoming call";
      callSummary = message.callData.duration;
      break;
    case "Missed call":
      icon = isVideoCall ? (
        <MissedVideoCallIcon sx={{ color: "red[700]", fontSize: iconSize }} />
      ) : (
        <PhoneMissedIcon sx={{ color: "red[700]", fontSize: iconSize }} />
      );
      label = "Missed call";
      callSummary = "Tap to call back";
      break;
    case "No answer":
      icon = isVideoCall ? (
        <VideoCallIcon sx={{ color: "gray[700]", fontSize: iconSize }} />
      ) : (
        <LocalPhoneIcon sx={{ color: "gray[700]", fontSize: iconSize }} />
      );
      label = "Voice call";
      callSummary = "No answer";
      break;
    case "Cancelled call":
      icon = isVideoCall ? (
        <VideoCallIcon sx={{ color: "gray[700]", fontSize: iconSize }} />
      ) : (
        <LocalPhoneIcon sx={{ color: "gray[700]", fontSize: iconSize }} />
      );
      label = isVideoCall ? "Video call" : "Voice call";
      callSummary = "Cancelled call";
      break;
    case "Declined call":
      icon = isVideoCall ? (
        <VideoCallIcon sx={{ color: "gray[700]", fontSize: iconSize }} />
      ) : (
        <LocalPhoneIcon sx={{ color: "gray[700]", fontSize: iconSize }} />
      );
      label = isVideoCall ? "Video call" : "Voice call";
      callSummary = "Declined call";
      break;
    case "Busy call":
      icon = isVideoCall ? (
        <MissedVideoCallIcon sx={{ color: "red[700]", fontSize: iconSize }} />
      ) : (
        <PhoneMissedIcon sx={{ color: "red[700]", fontSize: iconSize }} />
      );
      label = isVideoCall ? "Video call" : "Voice call";
      callSummary = "Busy call";
      break;
    default:
      label = status || "Unknown status";
      break;
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        padding: "8px 12px",
        borderRadius: "8px",
        maxWidth: "320px",
        cursor: "pointer",
      }}
      onClick={() => makeCall(chat, !isVideoCall)}
    >
      <Box
        sx={{
          display: "grid",
          placeItems: "center",
          width: "35px",
          height: "35px",
          bgcolor: isUserCaller ? "primary.light" : "background.default",
          filter: "brightness(0.875)",
          border: "none",
          borderRadius: "50%",
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography
          variant="body2"
          sx={{ fontSize: "0.85rem", fontWeight: 600 }}
        >
          {label}
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontSize: "0.85rem", color: "text.Secondary" }}
        >
          {callSummary}
        </Typography>
      </Box>
    </Box>
  );
};

CallMsg.propTypes = {
  message: PropTypes.object.isRequired,
  makeCall: PropTypes.func.isRequired,
};

export default CallMsg;
