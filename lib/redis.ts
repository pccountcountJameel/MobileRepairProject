import { createClient } from "redis";

const globalForRedis = globalThis as unknown as {
  redisClient?: ReturnType<typeof createClient>;
};

export const redis =
  globalForRedis.redisClient ??
  createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT || 18521),
      reconnectStrategy: false,
    },
  });

if (!globalForRedis.redisClient) {
  globalForRedis.redisClient = redis;
}

redis.on("error", (error) => {
  console.error("Redis connection error:", error.message);
});