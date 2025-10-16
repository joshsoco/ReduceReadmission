import { Redis } from '@upstash/redis';

let redis = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
} else {
  console.warn('⚠️Redis credentials not provided. Rate limiting will use in-memory fallback.');
}

const testRedisConnection = async () => {
  if (!redis) {
    console.log('Using in-memory rate limiting (Redis not configured)');
    return false;
  }

  try {
    const result = await redis.ping();
    console.log('Redis connected successfully:', result);
    return true;
  } catch (error) {
    console.error('Redis connection failed:', error.message);
    console.log('Falling back to in-memory rate limiting');
    return false;
  }
};

const inMemoryStore = new Map();

const rateLimitHelpers = {
  async getCurrentCount(key) {
    if (!redis) {
      const entry = inMemoryStore.get(key);
      return entry ? entry.count : 0;
    }

    try {
      const count = await redis.get(key);
      return parseInt(count) || 0;
    } catch (error) {
      console.error('Redis get error:', error);
      return 0;
    }
  },

  async incrementCount(key, ttl = 900) {
    if (!redis) {
      const now = Date.now();
      const entry = inMemoryStore.get(key);

      if (!entry || now > entry.expiry) {
        inMemoryStore.set(key, { count: 1, expiry: now + (ttl * 1000) });
        return 1;
      } else {
        entry.count++;
        return entry.count;
      }
    }

    try {
      const pipeline = redis.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, ttl);
      const results = await pipeline.exec();
      return results[0] || 1;
    } catch (error) {
      console.error('Redis increment error:', error);
      return 1;
    }
  },

  async setWithExpiry(key, value, ttl = 900) {
    if (!redis) {
      const now = Date.now();
      inMemoryStore.set(key, { count: value, expiry: now + (ttl * 1000) });
      return true;
    }

    try {
      await redis.setex(key, ttl, value);
      return true;
    } catch (error) {
      console.error('Redis setex error:', error);
      return false;
    }
  },

  async getTimeToLive(key) {
    if (!redis) {
      const entry = inMemoryStore.get(key);
      if (!entry) return -1;
      const remaining = Math.max(0, Math.ceil((entry.expiry - Date.now()) / 1000));
      return remaining;
    }

    try {
      const ttl = await redis.ttl(key);
      return ttl;
    } catch (error) {
      console.error('Redis ttl error:', error);
      return -1;
    }
  },

  async deleteKey(key) {
    if (!redis) {
      inMemoryStore.delete(key);
      return true;
    }

    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error('Redis delete error:', error);
      return false;
    }
  }
};

const sessionHelpers = {
  async setSession(sessionId, data, ttl = 86400) {
    if (!redis) {
      const now = Date.now();
      inMemoryStore.set(`session:${sessionId}`, {
        data: JSON.stringify(data),
        expiry: now + (ttl * 1000)
      });
      return true;
    }

    try {
      await redis.setex(`session:${sessionId}`, ttl, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Redis session set error:', error);
      return false;
    }
  },

  async getSession(sessionId) {
    if (!redis) {
      const entry = inMemoryStore.get(`session:${sessionId}`);
      if (!entry || Date.now() > entry.expiry) return null;
      return JSON.parse(entry.data);
    }

    try {
      const data = await redis.get(`session:${sessionId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis session get error:', error);
      return null;
    }
  },

  async deleteSession(sessionId) {
    if (!redis) {
      inMemoryStore.delete(`session:${sessionId}`);
      return true;
    }

    try {
      await redis.del(`session:${sessionId}`);
      return true;
    } catch (error) {
      console.error('Redis session delete error:', error);
      return false;
    }
  }
};

export {
  redis,
  testRedisConnection,
  rateLimitHelpers,
  sessionHelpers
};
