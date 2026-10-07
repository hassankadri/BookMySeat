const {
  Server,
} = require("socket.io");

let io = null;

const SHOW_ID_PATTERN =
  /^[a-fA-F0-9]{24}$/;

// =====================================================
// HELPERS
// =====================================================

const normalizeShowId = (
  showId
) => {
  const value =
    String(
      showId || ""
    ).trim();

  if (
    !SHOW_ID_PATTERN.test(
      value
    )
  ) {
    return null;
  }

  return value;
};

const getShowRoom = (
  showId
) =>
  `show:${showId}`;

// =====================================================
// INITIALIZE SOCKET.IO
// =====================================================

const initSocketServer = (
  httpServer,
  {
    allowedOrigins = [],
  } = {}
) => {
  if (io) {
    return io;
  }

  io = new Server(
    httpServer,
    {
      cors: {
        origin: (
          origin,
          callback
        ) => {
          /**
           * Requests without Origin are useful for:
           * - local testing
           * - mobile/native clients
           * - server-to-server clients
           */
          if (
            !origin ||
            allowedOrigins.includes(
              origin
            )
          ) {
            return callback(
              null,
              true
            );
          }

          return callback(
            new Error(
              `Socket.IO CORS blocked request from ${origin}`
            )
          );
        },

        credentials: true,
      },

      /**
       * Socket.IO can use WebSocket when available
       * and fall back to HTTP polling when necessary.
       */
      transports: [
        "websocket",
        "polling",
      ],
    }
  );

  io.on(
    "connection",
    (socket) => {
      // -----------------------------------------------
      // JOIN SHOW ROOM
      // -----------------------------------------------

      socket.on(
        "show:join",
        async (
          payload = {},
          acknowledge
        ) => {
          const suppliedShowId =
            typeof payload ===
            "string"
              ? payload
              : payload.showId;

          const showId =
            normalizeShowId(
              suppliedShowId
            );

          if (!showId) {
            if (
              typeof acknowledge ===
              "function"
            ) {
              acknowledge({
                success: false,
                message:
                  "Invalid show ID.",
              });
            }

            return;
          }

          const room =
            getShowRoom(
              showId
            );

          /**
           * A seat-map browser normally watches one show
           * at a time.
           *
           * Leave the old show room before joining another.
           */
          if (
            socket.data
              .showRoom &&
            socket.data
              .showRoom !==
              room
          ) {
            await socket.leave(
              socket.data
                .showRoom
            );
          }

          await socket.join(
            room
          );

          socket.data.showRoom =
            room;

          socket.data.showId =
            showId;

          socket.emit(
            "show:joined",
            {
              showId,
            }
          );

          if (
            typeof acknowledge ===
            "function"
          ) {
            acknowledge({
              success: true,
              showId,
            });
          }
        }
      );

      // -----------------------------------------------
      // LEAVE SHOW ROOM
      // -----------------------------------------------

      socket.on(
        "show:leave",
        async (
          payload = {},
          acknowledge
        ) => {
          const suppliedShowId =
            typeof payload ===
            "string"
              ? payload
              : payload.showId;

          const showId =
            normalizeShowId(
              suppliedShowId ||
                socket.data
                  .showId
            );

          if (!showId) {
            if (
              typeof acknowledge ===
              "function"
            ) {
              acknowledge({
                success: false,
                message:
                  "Invalid show ID.",
              });
            }

            return;
          }

          const room =
            getShowRoom(
              showId
            );

          await socket.leave(
            room
          );

          if (
            socket.data
              .showRoom ===
            room
          ) {
            socket.data.showRoom =
              null;

            socket.data.showId =
              null;
          }

          if (
            typeof acknowledge ===
            "function"
          ) {
            acknowledge({
              success: true,
              showId,
            });
          }
        }
      );
    }
  );

  console.log(
    "✅ Socket.IO ready"
  );

  return io;
};

// =====================================================
// EMIT TO EVERYONE WATCHING ONE SHOW
// =====================================================

/**
 * Routes and webhooks call this helper instead of importing
 * the Socket.IO server directly.
 *
 * Public seat events NEVER include:
 * - userId
 * - lockId
 * - payment information
 */
const emitToShow = (
  showId,
  eventName,
  payload = {}
) => {
  if (!io) {
    return false;
  }

  const normalizedShowId =
    normalizeShowId(
      showId
    );

  if (
    !normalizedShowId ||
    !eventName
  ) {
    return false;
  }

  io
    .to(
      getShowRoom(
        normalizedShowId
      )
    )
    .emit(
      eventName,
      {
        showId:
          normalizedShowId,

        ...payload,
      }
    );

  return true;
};

module.exports = {
  initSocketServer,
  emitToShow,
};