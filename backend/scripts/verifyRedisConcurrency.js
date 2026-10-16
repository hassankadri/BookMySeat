
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const {
  getRedisClient,
} = require("../config/redis");

const {
  lockSeats,
  verifySeatLocks,
  releaseSeats,
} = require("../services/seatLockService");

const {
  configureQueue,
  getConfiguration,
  joinQueue,
  verifyAdmission,
  leaveQueue,
} = require("../services/virtualQueueService");

// =====================================================
// ISOLATED DATA
// =====================================================

const delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const randomId = () =>
  crypto.randomBytes(12).toString("hex");

const runId = randomId();
const seatShowId = randomId();
const queueShowId = randomId();

const seatIds = [
  "A1",
  "B1",
  "B2",
  "C1",
  "C2",
];

const users = Array.from(
  { length: 30 },
  (_, index) => `local-load-${runId}-${index}`
);

// =====================================================
// SAFETY
// =====================================================

function requireLocalOptIn() {
  if (
    process.env.BMS_LOCAL_REDIS_LOAD_TEST !==
    "YES"
  ) {
    throw new Error(
      "Set BMS_LOCAL_REDIS_LOAD_TEST=YES to run isolated Redis checks."
    );
  }

  const rawUrl = process.env.REDIS_URL;

  if (!rawUrl) {
    throw new Error("REDIS_URL is required.");
  }

  const url = new URL(rawUrl);

  if (
    url.protocol !== "redis:" ||
    ![
      "redis",
      "localhost",
      "127.0.0.1",
    ].includes(url.hostname)
  ) {
    throw new Error(
      "These checks can run only against local Docker Redis."
    );
  }
}

// =====================================================
// TEST RUNNER
// =====================================================

async function runCase(title, test) {
  await test();
  console.log(`PASS  ${title}`);
}

// =====================================================
// CLEANUP
// =====================================================

async function cleanUp(redis, generation) {
  const seatKeys = seatIds.map(
    (seatId) =>
      `seat-lock:{${seatShowId}}:${seatId}`
  );

  const queueKeys = [
    `bms:vq:config:${queueShowId}`,
    `bms:vq:waiting:${queueShowId}`,
    `bms:vq:active:${queueShowId}`,
    `bms:vq:heartbeat:${queueShowId}`,
    `bms:vq:sequence:${queueShowId}`,
  ];

  const tokenKeys = generation
    ? users.map(
        (userId) =>
          `bms:vq:token:${queueShowId}:${generation}:${userId}`
      )
    : [];

  await redis.del([
    ...seatKeys,
    ...queueKeys,
    ...tokenKeys,
  ]);
}

// =====================================================
// MAIN TEST SUITE
// =====================================================

async function main() {
  requireLocalOptIn();

  const redis = await getRedisClient();

  let generation = null;
  let admissionToExpire = null;

  console.log(
    "Running isolated BookMySeat Redis concurrency checks..."
  );

  try {
    // ===============================================
    // TEST 1 — SINGLE WINNER
    // ===============================================

    await runCase(
      "25 competing users: exactly one seat-lock winner",
      async () => {
        const contenders = users.slice(0, 25);

        const results = await Promise.all(
          contenders.map((userId) =>
            lockSeats({
              showId: seatShowId,
              seatIds: ["A1"],
              userId,
            })
          )
        );

        const winners = results
          .map((result, index) => ({
            result,
            userId: contenders[index],
          }))
          .filter(
            ({ result }) => result.success
          );

        assert.equal(winners.length, 1);

        assert.equal(
          results.filter(
            (result) => !result.success
          ).length,
          24
        );

        const winner = winners[0];

        const losingUser = contenders.find(
          (id) => id !== winner.userId
        );

        // Another user cannot release the winner's lock.

        const unauthorizedRelease =
          await releaseSeats({
            showId: seatShowId,
            seatIds: ["A1"],
            userId: losingUser,
            lockId: winner.result.lockId,
          });

        assert.equal(
          unauthorizedRelease.released,
          0
        );

        const ownerStillHolds =
          await verifySeatLocks({
            showId: seatShowId,
            seatIds: ["A1"],
            userId: winner.userId,
            lockId: winner.result.lockId,
          });

        assert.equal(
          ownerStillHolds.valid,
          true
        );

        const released = await releaseSeats({
          showId: seatShowId,
          seatIds: ["A1"],
          userId: winner.userId,
          lockId: winner.result.lockId,
        });

        assert.equal(released.released, 1);
      }
    );

    // ===============================================
    // TEST 2 — ALL-OR-NOTHING ACQUISITION
    // ===============================================

    await runCase(
      "Multi-seat conflicts never partially acquire locks",
      async () => {
        const first = await lockSeats({
          showId: seatShowId,
          seatIds: ["B1"],
          userId: users[0],
        });

        assert.equal(first.success, true);

        const conflict = await lockSeats({
          showId: seatShowId,
          seatIds: ["B1", "B2"],
          userId: users[1],
        });

        assert.equal(conflict.success, false);

        // B2 must remain available because the
        // competing multi-seat operation failed.

        const independent = await lockSeats({
          showId: seatShowId,
          seatIds: ["B2"],
          userId: users[1],
        });

        assert.equal(independent.success, true);

        await releaseSeats({
          showId: seatShowId,
          seatIds: ["B1"],
          userId: users[0],
          lockId: first.lockId,
        });

        await releaseSeats({
          showId: seatShowId,
          seatIds: ["B2"],
          userId: users[1],
          lockId: independent.lockId,
        });
      }
    );

    // ===============================================
    // TEST 3 — LOCK TTL AND OWNERSHIP
    // ===============================================

    await runCase(
      "Adding a seat does not reset the original hold TTL",
      async () => {
        const first = await lockSeats({
          showId: seatShowId,
          seatIds: ["C1"],
          userId: users[2],
        });

        assert.equal(first.success, true);

        await delay(1500);

        const extended = await lockSeats({
          showId: seatShowId,
          seatIds: ["C1", "C2"],
          userId: users[2],
        });

        assert.equal(extended.success, true);

        assert.equal(
          extended.lockId,
          first.lockId
        );

        assert.ok(
          extended.expiresIn <
            first.expiresIn
        );

        const fakeOwner = await verifySeatLocks({
          showId: seatShowId,
          seatIds: ["C1", "C2"],
          userId: users[3],
          lockId: first.lockId,
        });

        assert.equal(fakeOwner.valid, false);

        await releaseSeats({
          showId: seatShowId,
          seatIds: ["C1", "C2"],
          userId: users[2],
          lockId: first.lockId,
        });
      }
    );

    // ===============================================
    // TEST 4 — QUEUE CONCURRENCY
    // ===============================================

    await runCase(
      "Concurrent queue joins respect admission capacity",
      async () => {
        // Short lease is used only by this isolated
        // service-level check. The production API
        // retains its 60–900 second validation.

        const config = await configureQueue({
          showId: queueShowId,
          enabled: true,
          capacity: 3,
          admissionSeconds: 3,
          expiresAt: new Date(
            Date.now() + 10 * 60 * 1000
          ),
        });

        assert.equal(config.enabled, true);
        assert.equal(config.capacity, 3);

        generation = await redis.hGet(
          `bms:vq:config:${queueShowId}`,
          "generation"
        );

        const results = await Promise.all(
          users.map((userId) =>
            joinQueue({
              showId: queueShowId,
              userId,
            })
          )
        );

        const admitted = results
          .map((result, index) => ({
            ...result,
            userId: users[index],
          }))
          .filter(
            (result) =>
              result.state === "ADMITTED"
          );

        const waiting = results
          .map((result, index) => ({
            ...result,
            userId: users[index],
          }))
          .filter(
            (result) =>
              result.state === "WAITING"
          );

        assert.equal(admitted.length, 3);

        assert.equal(
          waiting.length,
          users.length - 3
        );

        // All waiting positions must be unique
        // and must form a continuous FIFO sequence.

        assert.deepEqual(
          waiting
            .map((result) => result.position)
            .sort((a, b) => a - b),

          Array.from(
            { length: 27 },
            (_, index) => index + 1
          )
        );

        const first = admitted[0];

        admissionToExpire = admitted[1];

        const valid = await verifyAdmission({
          showId: queueShowId,
          userId: first.userId,
          token: first.admissionToken,
        });

        assert.equal(valid.allowed, true);

        // A forged token must be rejected.

        const forged = await verifyAdmission({
          showId: queueShowId,
          userId: first.userId,
          token: "invalid-token",
        });

        assert.equal(forged.allowed, false);

        // A token cannot be borrowed by another user.

        const wrongUser = await verifyAdmission({
          showId: queueShowId,
          userId: waiting[0].userId,
          token: first.admissionToken,
        });

        assert.equal(wrongUser.allowed, false);

        // Leaving releases admission capacity.

        await leaveQueue({
          showId: queueShowId,
          userId: first.userId,
        });

        const nextUser = waiting.find(
          (item) => item.position === 1
        );

        const next = await joinQueue({
          showId: queueShowId,
          userId: nextUser.userId,
        });

        assert.equal(
          next.state,
          "ADMITTED"
        );
      }
    );

    // ===============================================
    // TEST 5 — EXPIRED ADMISSION
    // ===============================================

    await runCase(
      "Expired admissions cannot be reused",
      async () => {
        assert.ok(
          admissionToExpire?.admissionToken
        );

        const remaining =
          Date.parse(
            admissionToExpire.admittedUntil
          ) - Date.now();

        await delay(
          Math.max(0, remaining + 150)
        );

        const config =
          await getConfiguration(queueShowId);

        assert.equal(config.enabled, true);

        const check = await verifyAdmission({
          showId: queueShowId,
          userId: admissionToExpire.userId,
          token:
            admissionToExpire.admissionToken,
        });

        assert.equal(check.allowed, false);
      }
    );

    // ===============================================
    // TEST 6 — DISABLED QUEUE
    // ===============================================

    await runCase(
      "Disabling the queue restores ordinary admission",
      async () => {
        await configureQueue({
          showId: queueShowId,
          enabled: false,
          capacity: 3,
          admissionSeconds: 300,
        });

        const result = await joinQueue({
          showId: queueShowId,
          userId: users[0],
        });

        assert.equal(result.state, "OFF");

        const admission = await verifyAdmission({
          showId: queueShowId,
          userId: users[0],
          token: "",
        });

        assert.equal(admission.allowed, true);
      }
    );

    console.log(
      "\nAll isolated Redis concurrency checks passed."
    );
  } finally {
    try {
      await cleanUp(redis, generation);

      console.log(
        "Temporary Redis keys cleaned up."
      );
    } finally {
      if (redis.isOpen) {
        await redis.quit();
      }
    }
  }
}

main().catch((error) => {
  console.error(
    "FAIL",
    error.stack || error.message
  );

  process.exitCode = 1;
});
