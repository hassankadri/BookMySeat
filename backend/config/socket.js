
"use strict";

const { Server } = require("socket.io");

const {
  publishSeatEvent,
} = require("../services/seatEventStream");

const {
  consumeSeatEventPage,
} = require("../services/seatEventReplayConsumer");

let io = null;

const SHOW_ID_PATTERN = /^[a-fA-F0-9]{24}$/;
const REPLAY_COOLDOWN_MS = 1000;

function normalizeShowId(value) {
  const id = String(value || "").trim();

  return SHOW_ID_PATTERN.test(id)
    ? id.toLowerCase()
    : null;
}

function getShowRoom(showId) {
  return `show:${showId}`;
}

function acknowledgeSafely(callback, response) {
  if (typeof callback === "function") {
    callback(response);
  }
}

function initSocketServer(
  httpServer,
  { allowedOrigins = [] } = {}
) {
  if (io) return io;

  io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (
          !origin ||
          allowedOrigins.includes(origin)
        ) {
          return callback(null, true);
        }

        return callback(
          new Error(
            `Socket.IO CORS blocked request from ${origin}`
          )
        );
      },
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    // =================================================
    // JOIN SHOW ROOM
    // =================================================

    socket.on(
      "show:join",
      async (payload = {}, acknowledge) => {
        const suppliedId =
          typeof payload === "string"
            ? payload
            : payload?.showId;

        const showId = normalizeShowId(suppliedId);

        if (!showId) {
          acknowledgeSafely(acknowledge, {
            success: false,
            message: "Invalid show ID.",
          });
          return;
        }

        try {
          const room = getShowRoom(showId);

          if (
            socket.data.showRoom &&
            socket.data.showRoom !== room
          ) {
            await socket.leave(
              socket.data.showRoom
            );
          }

          await socket.join(room);

          socket.data.showRoom = room;
          socket.data.showId = showId;

          socket.emit("show:joined", {
            showId,
          });

          acknowledgeSafely(acknowledge, {
            success: true,
            showId,
          });
        } catch (error) {
          console.error(
            "Socket show:join error:",
            error
          );

          acknowledgeSafely(acknowledge, {
            success: false,
            message: "Unable to join show.",
          });
        }
      }
    );

    // =================================================
    // LEAVE SHOW ROOM
    // =================================================

    socket.on(
      "show:leave",
      async (payload = {}, acknowledge) => {
        const suppliedId =
          typeof payload === "string"
            ? payload
            : payload?.showId;

        const showId = normalizeShowId(
          suppliedId || socket.data.showId
        );

        if (!showId) {
          acknowledgeSafely(acknowledge, {
            success: false,
            message: "Invalid show ID.",
          });
          return;
        }

        try {
          const room = getShowRoom(showId);

          await socket.leave(room);

          if (socket.data.showRoom === room) {
            socket.data.showRoom = null;
            socket.data.showId = null;
          }

          acknowledgeSafely(acknowledge, {
            success: true,
            showId,
          });
        } catch (error) {
          console.error(
            "Socket show:leave error:",
            error
          );

          acknowledgeSafely(acknowledge, {
            success: false,
            message: "Unable to leave show.",
          });
        }
      }
    );

    // =================================================
    // REPLAY MISSED SEAT EVENTS
    // =================================================
    //
    // A client that joined a show can request the
    // retained event history using a Redis cursor.
    //
    // Event history is sent through an acknowledgement,
    // never rebroadcast as a new live seat event.
    //
    // Current seat availability remains authoritative
    // through the existing seat-lock and booking APIs.

    socket.on(
      "show:replay",
      async (payload = {}, acknowledge) => {
        if (typeof acknowledge !== "function") {
          return;
        }

        const showId = normalizeShowId(
          payload?.showId
        );

        if (
          !showId ||
          socket.data.showRoom !==
            getShowRoom(showId)
        ) {
          acknowledgeSafely(acknowledge, {
            success: false,
            message:
              "Join this show before requesting replay.",
          });
          return;
        }

        const now = Date.now();

        if (
          socket.data.replayInFlight ||
          now -
            (socket.data.lastReplayAt || 0) <
            REPLAY_COOLDOWN_MS
        ) {
          acknowledgeSafely(acknowledge, {
            success: false,
            message:
              "Please wait before requesting another replay.",
          });
          return;
        }

        socket.data.replayInFlight = true;
        socket.data.lastReplayAt = now;

        try {
          const result =
            await consumeSeatEventPage({
              showId,
              after:
                payload?.after ?? "0-0",
              limit:
                payload?.limit ?? 50,
            });

          // Do not deliver old-show history if the
          // socket switched rooms during the query.
          if (
            !socket.connected ||
            socket.data.showRoom !==
              getShowRoom(showId)
          ) {
            return;
          }

          acknowledgeSafely(acknowledge, {
            success: true,
            showId,
            ...result,
          });
        } catch (error) {
          if (
            error.code === "INVALID_EVENT_CURSOR" ||
            error.code === "INVALID_EVENT_LIMIT"
          ) {
            acknowledgeSafely(acknowledge, {
              success: false,
              message: error.message,
            });
          } else {
            console.error(
              "Socket show:replay error:",
              error
            );

            acknowledgeSafely(acknowledge, {
              success: false,
              message:
                "Event history is temporarily unavailable.",
            });
          }
        } finally {
          socket.data.replayInFlight = false;
        }
      }
    );
  });

  console.log("Socket.IO ready");

  return io;
}

// =====================================================
// REAL-TIME EVENTS + REDIS STREAM JOURNAL
// =====================================================

function emitToShow(
  showId,
  eventName,
  payload = {}
) {
  if (!io) return false;

  const id = normalizeShowId(showId);

  if (!id || !eventName) {
    return false;
  }

  // Preserve the existing real-time broadcast.
  io.to(getShowRoom(id)).emit(
    eventName,
    {
      showId: id,
      ...payload,
    }
  );

  // Record supported events asynchronously.
  // A journal failure must not fail a booking.
  void publishSeatEvent(
    id,
    eventName,
    payload
  ).catch((error) => {
    console.error(
      "Seat event journal write failed:",
      error.message
    );
  });

  return true;
}

module.exports = {
  initSocketServer,
  emitToShow,
};
