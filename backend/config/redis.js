
const { createClient } = require("redis");

let redisClient = null;
let connectionPromise = null;

/**
 * Return the shared Redis client. Concurrent first requests must await the
 * same connection attempt instead of calling connect() on an opening socket.
 */
const getRedisClient = async () => {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is missing from environment variables.");
  }

  if (!redisClient) {
    redisClient = createClient({ url: process.env.REDIS_URL });

    redisClient.on("error", (error) => {
      console.error("Redis error:", error);
    });
    redisClient.on("connect", () => {
      console.log("Connecting to Redis...");
    });
    redisClient.on("ready", () => {
      console.log("Redis connected.");
    });
  }

  const client = redisClient;

  if (!client.isOpen) {
    if (!connectionPromise) {
      connectionPromise = client.connect().catch((error) => {
        // A failed initial connection must be retryable on the next request.
        if (redisClient === client) redisClient = null;
        try {
          client.destroy();
        } catch {
          // Already closed by the Redis client.
        }
        throw error;
      }).finally(() => {
        connectionPromise = null;
      });
    }

    await connectionPromise;
  }

  return client;
};

module.exports = { getRedisClient };
