const { createClient } = require("redis");

let redisClient = null;

const getRedisClient = async () => {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is missing from environment variables.");
  }

  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL,
    });

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

  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  return redisClient;
};

module.exports = {
  getRedisClient,
};