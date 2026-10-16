
import axios from "axios";

const REPLAY_PAGE_SIZE = 100;
const REPLAY_COOLDOWN_MS = 1100;
const ACK_TIMEOUT_MS = 5000;

const wait = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function emitWithAck(socket, eventName, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(ACK_TIMEOUT_MS).emit(
      eventName,
      payload,
      (error, reply) => {
        if (error) reject(error);
        else resolve(reply);
      }
    );
  });
}

/**
 * Attach event replay and authoritative seat reconciliation
 * to Booking.jsx's EXISTING Socket.IO connection.
 *
 * Historical stream events cannot determine present
 * availability because Redis seat holds can expire.
 * Current seat state always comes from the existing APIs.
 */
export function attachSeatEventRecovery({
  socket,
  showId,
  apiUrl,
  onBookedSnapshot,
  refreshLockedSeats,
}) {
  if (!socket || !showId) return () => {};

  const cursorKey =
    `bookmyseat_seat_event_cursor:${showId}`;

  let active = true;
  let generation = 0;
  let liveVersion = 0;

  const valid = (request) =>
    active &&
    generation === request &&
    socket.connected;

  const onLiveEvent = (payload) => {
    if (
      !payload?.showId ||
      String(payload.showId) === String(showId)
    ) {
      liveVersion += 1;
    }
  };

  const readCursor = () => {
    try {
      return (
        sessionStorage.getItem(cursorKey) || "0-0"
      );
    } catch {
      return "0-0";
    }
  };

  const saveCursor = (cursor) => {
    try {
      sessionStorage.setItem(cursorKey, cursor);
    } catch {
      // Browser storage is optional.
    }
  };

  // ===================================================
  // REDIS STREAM REPLAY
  // ===================================================

  const replayEvents = async (request) => {
    let cursor = readCursor();

    // Process at most two pages per connection.
    // Additional history remains available using
    // the stored cursor on a future reconnect.
    for (
      let pageIndex = 0;
      pageIndex < 2 && valid(request);
      pageIndex += 1
    ) {
      if (pageIndex > 0) {
        await wait(REPLAY_COOLDOWN_MS);
      }

      if (!valid(request)) return;

      const reply = await emitWithAck(
        socket,
        "show:replay",
        {
          showId,
          after: cursor,
          limit: REPLAY_PAGE_SIZE,
        }
      );

      if (!valid(request)) return;

      if (
        !reply?.success ||
        !Array.isArray(reply.events)
      ) {
        return;
      }

      if (
        reply.nextCursor &&
        reply.nextCursor !== cursor
      ) {
        cursor = reply.nextCursor;
        saveCursor(cursor);
      }

      if (
        !reply.mayHaveMore ||
        reply.events.length === 0
      ) {
        return;
      }
    }
  };

  // ===================================================
  // AUTHORITATIVE BOOKED-SEAT RECONCILIATION
  // ===================================================

  const reconcileSnapshot = async (request) => {
    // If a live event arrives during the REST request,
    // retry instead of overwriting fresher socket state.
    for (
      let attempt = 0;
      attempt < 3 && valid(request);
      attempt += 1
    ) {
      const versionBeforeFetch = liveVersion;

      const { data } = await axios.get(
        `${apiUrl}/api/shows/${showId}`,
        { timeout: 12000 }
      );

      if (!valid(request)) return;

      if (liveVersion !== versionBeforeFetch) {
        continue;
      }

      if (
        Array.isArray(data?.show?.bookedSeats)
      ) {
        onBookedSnapshot(
          data.show.bookedSeats
        );
      }

      return;
    }
  };

  // ===================================================
  // RECONNECT AND RECOVER
  // ===================================================

  const connectAndRecover = async () => {
    const request = ++generation;

    try {
      const join = await emitWithAck(
        socket,
        "show:join",
        { showId }
      );

      if (!valid(request) || !join?.success) {
        return;
      }

      // Historical replay is best-effort.
      // Failure must never block live seat recovery.
      try {
        await replayEvents(request);
      } catch (error) {
        if (valid(request)) {
          console.warn(
            "Seat event replay unavailable:",
            error
          );
        }
      }

      if (!valid(request)) return;

      try {
        await reconcileSnapshot(request);
      } catch (error) {
        if (valid(request)) {
          console.warn(
            "Seat booking reconciliation unavailable:",
            error
          );
        }
      }

      if (valid(request)) {
        await refreshLockedSeats();
      }
    } catch (error) {
      if (valid(request)) {
        console.warn(
          "Rejoining booking updates failed:",
          error
        );

        // Existing REST polling remains available.
        await refreshLockedSeats();
      }
    }
  };

  // ===================================================
  // ATTACH TO EXISTING SOCKET — NO SECOND CONNECTION
  // ===================================================

  socket.on("seats:held", onLiveEvent);
  socket.on("seats:released", onLiveEvent);
  socket.on("seats:booked", onLiveEvent);
  socket.on("connect", connectAndRecover);

  if (socket.connected) {
    void connectAndRecover();
  }

  // Unregister only handlers added by this module.
  return () => {
    active = false;
    generation += 1;

    socket.off("connect", connectAndRecover);
    socket.off("seats:held", onLiveEvent);
    socket.off("seats:released", onLiveEvent);
    socket.off("seats:booked", onLiveEvent);
  };
}
