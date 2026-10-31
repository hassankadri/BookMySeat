import { io } from "socket.io-client";

const SOCKET_URL =
  process.env.REACT_APP_BACKEND_URL ||
  "http://localhost:5000";

/**
 * One Socket.IO connection is shared by the booking page.
 *
 * autoConnect is false because we only need the socket while
 * somebody is actually viewing a seat map.
 */
const socket = io(
  SOCKET_URL,
  {
    autoConnect: false,
    withCredentials: true,

    transports: [
      "websocket",
      "polling",
    ],
  }
);

export default socket;