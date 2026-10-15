
const crypto = require("crypto");

const {
  lockSeats,
  releaseSeats,
} = require("./services/seatLockService");

const {
  getRedisClient,
} = require("./config/redis");

async function main() {
  const redis = await getRedisClient();
  let passed = 0;

  try {
    for (let round = 1; round <= 25; round++) {
      // Unique test-only show, not a real booking
      const showId = crypto.randomBytes(12).toString("hex");
      const seatIds = ["TEST_SEAT_A1"];

      const users = [
        `test-user-a-${showId}`,
        `test-user-b-${showId}`,
      ];

      let results = [];

      try {
        // Both users attempt the same seat simultaneously
        results = await Promise.all(
          users.map((userId) =>
            lockSeats({ showId, seatIds, userId })
          )
        );

        const winners = results.filter(
          (result) => result.success
        );

        if (winners.length !== 1) {
          throw new Error(
            `Round ${round}: expected 1 winner, got ${winners.length}`
          );
        }

        passed++;
      } finally {
        // Clean up only locks created by this test
        for (let i = 0; i < results.length; i++) {
          if (results[i].success) {
            await releaseSeats({
              showId,
              seatIds,
              userId: users[i],
              lockId: results[i].lockId,
            });
          }
        }
      }
    }

    console.log(
      `PASS: ${passed}/25 rounds. Exactly one user locked the seat each time.`
    );
  } finally {
    await redis.quit();
  }
}

main().catch((error) => {
  console.error("FAIL:", error.message);
  process.exitCode = 1;
});
