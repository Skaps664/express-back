const Redis = require("ioredis");

// Redis configuration for high-scale caching
let redisClient = null;

const initializeRedis = () => {
  if (process.env.REDIS_URL || process.env.REDIS_HOST) {
    try {
      // Use Redis URL if provided (recommended approach)
      if (process.env.REDIS_URL) {
        console.log("🔗 Connecting to Redis using REDIS_URL...");
        redisClient = new Redis(process.env.REDIS_URL, {
          // High-performance settings for 100k+ users
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          enableReadyCheck: true,
          maxLoadingTime: 2000,

          // Connection pooling
          family: 4,
          keepAlive: true,
          connectTimeout: 10000,
          commandTimeout: 5000,

          // Reconnection settings
          reconnectOnError: (err) => {
            const targetError = "READONLY";
            return err.message.includes(targetError);
          },

          // Performance optimizations
          enableOfflineQueue: true, // Enable queue for better reliability
          lazyConnect: false, // Connect immediately
        });
      } else {
        // Fallback to individual settings
        const redisConfig = {
          // Connection settings
          host: process.env.REDIS_HOST || "localhost",
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD,
          db: process.env.REDIS_DB || 0,

          // High-performance settings for 100k+ users
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          enableReadyCheck: true,
          maxLoadingTime: 2000,

          // Connection pooling
          family: 4,
          keepAlive: true,
          connectTimeout: 10000,
          commandTimeout: 5000,

          // Reconnection settings
          reconnectOnError: (err) => {
            const targetError = "READONLY";
            return err.message.includes(targetError);
          },

          // Performance optimizations
          enableOfflineQueue: true,
          lazyConnect: false,
        };

        redisClient = new Redis(redisConfig);
      }

      redisClient.on("connect", () => {
        console.log("✅ Redis connected successfully");
      });

      redisClient.on("error", (err) => {
        console.log("❌ Redis connection error:", err.message);
        redisClient = null; // Fallback to no caching
      });

      redisClient.on("reconnecting", () => {
        console.log("🔄 Redis reconnecting...");
      });
    } catch (error) {
      console.log("❌ Redis initialization failed:", error.message);
      redisClient = null;
    }
  } else {
    console.log("⚠️ Redis not configured - caching disabled");
  }
};

// Cache helper functions
const cache = {
  get redisClient() {
    return redisClient;
  },

  async get(key) {
    if (!redisClient) return null;
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.log("Cache get error:", error.message);
      return null;
    }
  },

  async set(key, value, ttl = 300) {
    // Default 5 minutes
    if (!redisClient) return false;
    try {
      await redisClient.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.log("Cache set error:", error.message);
      return false;
    }
  },

  async del(key) {
    if (!redisClient) return false;
    try {
      await redisClient.del(key);
      return true;
    } catch (error) {
      console.log("Cache delete error:", error.message);
      return false;
    }
  },

  async flush() {
    if (!redisClient) return false;
    try {
      await redisClient.flushdb();
      return true;
    } catch (error) {
      console.log("Cache flush error:", error.message);
      return false;
    }
  },

  // Advanced caching patterns for high scale
  async mget(keys) {
    if (!redisClient || !keys.length) return {};
    try {
      const values = await redisClient.mget(keys);
      const result = {};
      keys.forEach((key, index) => {
        if (values[index]) {
          result[key] = JSON.parse(values[index]);
        }
      });
      return result;
    } catch (error) {
      console.log("Cache mget error:", error.message);
      return {};
    }
  },

  async mset(keyValuePairs, ttl = 300) {
    if (!redisClient || !Object.keys(keyValuePairs).length) return false;
    try {
      const pipeline = redisClient.pipeline();
      for (const [key, value] of Object.entries(keyValuePairs)) {
        pipeline.setex(key, ttl, JSON.stringify(value));
      }
      await pipeline.exec();
      return true;
    } catch (error) {
      console.log("Cache mset error:", error.message);
      return false;
    }
  },
};

// High-performance cache helper functions for API endpoints
const getFromCache = async (key) => {
  return await cache.get(key);
};

const setCache = async (key, data, ttl = 300) => {
  return await cache.set(key, data, ttl);
};

// Batch cache operations for better performance
const batchCache = async (operations) => {
  if (!redisClient || !operations.length) return false;
  try {
    const pipeline = redisClient.pipeline();
    operations.forEach(({ key, data, ttl = 300 }) => {
      pipeline.setex(key, ttl, JSON.stringify(data));
    });
    await pipeline.exec();
    return true;
  } catch (error) {
    console.log("Batch cache error:", error.message);
    return false;
  }
};

// Graceful shutdown
process.on("SIGINT", async () => {
  if (redisClient) {
    await redisClient.quit();
    console.log("Redis connection closed");
  }
});

module.exports = {
  cache,
  initializeRedis,
  redisClient,
  getFromCache,
  setCache,
  batchCache,
};
