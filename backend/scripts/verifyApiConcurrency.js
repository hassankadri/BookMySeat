
"use strict";

const assert = require("node:assert/strict");

const BASE =
  process.env.BMS_TEST_API_URL ||
  "http://127.0.0.1:5000";

const TOKEN_A =
  process.env.BMS_TEST_TOKEN_A || "";

const TOKEN_B =
  process.env.BMS_TEST_TOKEN_B || "";

const QUEUE_SHOW =
  process.env.BMS_TEST_QUEUE_SHOW_ID || "";

const HOLD_SHOW =
  process.env.BMS_TEST_HOLD_SHOW_ID || "";

const HOLD_SEAT = (
  process.env.BMS_TEST_HOLD_SEAT_ID || ""
)
  .trim()
  .toUpperCase();

const RUN_HOLDS =
  process.env.BMS_TEST_ALLOW_HOLDS === "YES";

const OBJECT_ID = /^[a-f\d]{24}$/i;

// =====================================================
// LOCAL ENVIRONMENT SAFETY
// =====================================================

function safeguard() {
  if (
    process.env.BMS_LOCAL_API_TEST !== "YES"
  ) {
    throw new Error(
      "Set BMS_LOCAL_API_TEST=YES to run local API checks."
    );
  }

  const url = new URL(BASE);

  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(
      url.hostname
    )
  ) {
    throw new Error(
      "Refusing to run against a non-local API."
    );
  }

  if (
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "BMS_TEST_API_URL must contain only the local origin."
    );
  }

  if (TOKEN_B && !TOKEN_A) {
    throw new Error(
      "Test token A must be supplied first."
    );
  }

  if (
    QUEUE_SHOW &&
    (!TOKEN_A || !OBJECT_ID.test(QUEUE_SHOW))
  ) {
    throw new Error(
      "Queue bypass checks require token A and a valid show ID."
    );
  }

  if (
    RUN_HOLDS &&
    (
      !TOKEN_A ||
      !TOKEN_B ||
      !OBJECT_ID.test(HOLD_SHOW) ||
      !HOLD_SEAT ||
      HOLD_SEAT.length > 32
    )
  ) {
    throw new Error(
      "Seat contention requires two tokens, a show ID and seat ID."
    );
  }
}

// =====================================================
// HTTP CLIENT
// =====================================================

async function api(
  method,
  path,
  {
    token,
    body,
    admission,
  } = {}
) {
  const headers = {
    Accept: "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (admission) {
    headers["X-Queue-Admission"] = admission;
  }

  if (body !== undefined) {
    headers["Content-Type"] =
      "application/json";
  }

  const response = await fetch(
    `${BASE}${path}`,
    {
      method,
      headers,

      body:
        body === undefined
          ? undefined
          : JSON.stringify(body),

      signal: AbortSignal.timeout(12000),
    }
  );

  const responseText = await response.text();

  let data = {};

  try {
    data = JSON.parse(responseText);
  } catch {
    data = {
      message: responseText.slice(0, 160),
    };
  }

  return {
    status: response.status,
    data,
  };
}

async function verify(title, fn) {
  await fn();
  console.log(`PASS  ${title}`);
}

// =====================================================
// ACCOUNT VERIFICATION
// =====================================================

async function readIdentity(token) {
  const result = await api(
    "GET",
    "/api/auth/me",
    { token }
  );

  assert.equal(
    result.status,
    200,
    "The test account token was rejected."
  );

  const id = String(
    result.data?.user?._id ||
    result.data?.user?.id ||
    ""
  );

  assert.ok(
    OBJECT_ID.test(id),
    "Authenticated user ID was not returned."
  );

  return id;
}

// =====================================================
// BASIC API SECURITY CHECKS
// =====================================================

async function publicChecks() {
  await verify(
    "Backend metrics endpoint responds",
    async () => {
      const result = await api(
        "GET",
        "/api/metrics"
      );

      assert.equal(result.status, 200);
    }
  );

  await verify(
    "Malformed queue show ID rejected",
    async () => {
      const result = await api(
        "GET",
        "/api/queue/shows/not-a-show"
      );

      assert.equal(result.status, 400);
    }
  );

  await verify(
    "Unauthenticated seat hold blocked",
    async () => {
      const result = await api(
        "POST",
        "/api/seat-locks/hold",
        {
          body: {
            showId: "507f1f77bcf86cd799439011",
            seatIds: ["A1"],
          },
        }
      );

      assert.equal(result.status, 401);
    }
  );

  await verify(
    "Unauthenticated queue join blocked",
    async () => {
      const result = await api(
        "POST",
        "/api/queue/shows/507f1f77bcf86cd799439011/join"
      );

      assert.equal(result.status, 401);
    }
  );

  await verify(
    "Unauthenticated queue status blocked",
    async () => {
      const result = await api(
        "POST",
        "/api/queue/shows/507f1f77bcf86cd799439011/status"
      );

      assert.equal(result.status, 401);
    }
  );

  await verify(
    "Unauthenticated admin queue changes blocked",
    async () => {
      const result = await api(
        "PATCH",
        "/api/queue/admin/shows/507f1f77bcf86cd799439011",
        {
          body: {
            enabled: false,
          },
        }
      );

      assert.equal(result.status, 401);
    }
  );
}

// =====================================================
// QUEUE BYPASS PROTECTION
// =====================================================
//
// Read-only checks against the queue configuration.
//
// A missing or forged token must be rejected before
// any physical seat validation or Redis seat hold.
//
// This does NOT join, disable or reset the queue.

async function queueBypassChecks() {
  if (!QUEUE_SHOW) {
    console.log(
      "SKIP  Queue bypass: no queue show ID configured"
    );

    return;
  }

  const config = await api(
    "GET",
    `/api/queue/shows/${QUEUE_SHOW}`
  );

  assert.equal(
    config.status,
    200,
    "Queue configuration could not be loaded."
  );

  if (!config.data.enabled) {
    console.log(
      "SKIP  Queue bypass: selected show's queue is disabled"
    );

    return;
  }

  const holdBody = {
    showId: QUEUE_SHOW,
    seatIds: ["A1"],
  };

  await verify(
    "Active queue rejects missing admission",
    async () => {
      const result = await api(
        "POST",
        "/api/seat-locks/hold",
        {
          token: TOKEN_A,
          body: holdBody,
        }
      );

      assert.equal(
        result.status,
        403,
        JSON.stringify(result.data)
      );

      assert.equal(
        result.data.code,
        "QUEUE_ADMISSION_REQUIRED"
      );
    }
  );

  await verify(
    "Active queue rejects forged admission",
    async () => {
      const result = await api(
        "POST",
        "/api/seat-locks/hold",
        {
          token: TOKEN_A,
          admission: "not-a-valid-admission",
          body: holdBody,
        }
      );

      assert.equal(
        result.status,
        403,
        JSON.stringify(result.data)
      );

      assert.equal(
        result.data.code,
        "QUEUE_ADMISSION_REQUIRED"
      );
    }
  );
}

// =====================================================
// OPTIONAL HTTP SEAT CONTENTION
// =====================================================
//
// Requires:
//  - Two distinct authenticated accounts
//  - A dedicated future screening
//  - An available seat
//  - Virtual queue disabled on that screening
//
// Never creates Stripe payments or MongoDB bookings.
// Any successful temporary seat hold is released
// in finally, including when assertions fail.

async function contentionChecks() {
  if (!RUN_HOLDS) {
    console.log(
      "SKIP  HTTP seat contention: explicit opt-in not supplied"
    );

    return;
  }

  const config = await api(
    "GET",
    `/api/queue/shows/${HOLD_SHOW}`
  );

  assert.equal(
    config.status,
    200,
    "Hold show could not be loaded."
  );

  assert.equal(
    config.data.enabled,
    false,
    "Refusing contention checks on a show with an active queue."
  );

  const body = {
    showId: HOLD_SHOW,
    seatIds: [HOLD_SEAT],
  };

  const tokens = [
    TOKEN_A,
    TOKEN_B,
  ];

  const successes = [];
  const outcomes = [];

  try {
    // Two accounts compete for one seat.
    // Only one request is sent per account.

    const results = await Promise.allSettled(
      tokens.map((token) =>
        api(
          "POST",
          "/api/seat-locks/hold",
          {
            token,
            body,
          }
        )
      )
    );

    for (
      let index = 0;
      index < results.length;
      index++
    ) {
      const result = results[index];

      if (result.status !== "fulfilled") {
        outcomes.push("network-error");
        continue;
      }

      outcomes.push(result.value.status);

      if (
        result.value.status === 201 &&
        result.value.data.lockId
      ) {
        successes.push({
          token: tokens[index],
          lockId: result.value.data.lockId,
        });
      }
    }

    await verify(
      "Two HTTP users cannot hold the same seat",
      async () => {
        assert.equal(
          successes.length,
          1,
          `HTTP statuses: ${outcomes.join(", ")}`
        );

        assert.ok(
          outcomes.includes(409),
          `Expected one conflict; got ${outcomes.join(", ")}`
        );
      }
    );

    const winner = successes[0];

    const loser = tokens.find(
      (token) => token !== winner.token
    );

    await verify(
      "Another user cannot release the winner's lock",
      async () => {
        const result = await api(
          "DELETE",
          "/api/seat-locks/release",
          {
            token: loser,

            body: {
              ...body,
              lockId: winner.lockId,
            },
          }
        );

        assert.equal(
          result.status,
          200,
          JSON.stringify(result.data)
        );

        assert.equal(
          result.data.released,
          0
        );
      }
    );
  } finally {
    // Always try to release holds created by this run.
    // Redis TTL remains a fallback if cleanup fails.

    for (const held of successes) {
      try {
        const released = await api(
          "DELETE",
          "/api/seat-locks/release",
          {
            token: held.token,

            body: {
              ...body,
              lockId: held.lockId,
            },
          }
        );

        if (released.data.released !== 1) {
          console.error(
            "WARN  Cleanup not confirmed; the Redis hold expires automatically."
          );
        }
      } catch {
        console.error(
          "WARN  Cleanup failed; the Redis hold expires automatically."
        );
      }
    }
  }
}

// =====================================================
// RUNNER
// =====================================================

async function main() {
  safeguard();

  console.log(
    "BookMySeat local API verification\n"
  );

  await publicChecks();

  if (TOKEN_A) {
    const firstUser = await readIdentity(TOKEN_A);

    console.log(
      "PASS  Test account A authenticated"
    );

    if (TOKEN_B) {
      const secondUser = await readIdentity(TOKEN_B);

      assert.notEqual(
        firstUser,
        secondUser,
        "Test accounts must belong to different users."
      );

      console.log(
        "PASS  Test account B authenticated and distinct"
      );
    }

    await queueBypassChecks();
    await contentionChecks();
  } else {
    console.log(
      "SKIP  Authenticated checks: no account tokens configured"
    );
  }

  console.log(
    "\nCompleted local API verification."
  );
}

main().catch((error) => {
  console.error(
    "FAIL",
    error.stack || error.message
  );

  process.exitCode = 1;
});
