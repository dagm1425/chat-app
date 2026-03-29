// eslint-disable-next-line no-undef
const CALL_AUDIO_BASE_PATH = `${process.env.PUBLIC_URL || ""}/audio/call`;

const buildAudioPath = (fileName) => `${CALL_AUDIO_BASE_PATH}/${fileName}`;

export const CALL_STATUS_AUDIO_ASSETS = {
  outgoingLoop: buildAudioPath("outgoing-loop.mp3"),
  incomingLoop: buildAudioPath("incoming-loop.mp3"),
  lineBusy: buildAudioPath("line-busy.mp3"),
  connected: buildAudioPath("connected.mp3"),
  callEnded: buildAudioPath("call-ended.mp3"),
};

export const CALL_STATUS_AUDIO_VOLUME = {
  outgoingLoop: 0.7,
  incomingLoop: 0.8,
  lineBusy: 0.85,
  connected: 0.85,
  callEnded: 0.85,
};

const OUTGOING_STATUSES = new Set(["Calling...", "Ringing..."]);
const BUSY_STATUSES = new Set(["Line busy", "Everyone is busy"]);

export const getLoopTypeForStatus = ({ status, isRejoinCall, isInitiator }) => {
  if (OUTGOING_STATUSES.has(status)) {
    return "outgoingLoop";
  }
  if (status === "" && !isRejoinCall && !isInitiator) {
    return "incomingLoop";
  }
  return null;
};

export const getOneShotEventForTransition = ({ prevStatus, status }) => {
  if (status === prevStatus) {
    return null;
  }

  if (BUSY_STATUSES.has(status)) {
    return "lineBusy";
  }
  if (status === "Ongoing call") {
    return "connected";
  }
  if (status === "Call ended") {
    return "callEnded";
  }

  return null;
};
