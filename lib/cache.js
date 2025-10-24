class ResponseCache {
  constructor(maxSize = 1000, ttl = 300000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  generateKey(message, model, language) {
    return `${model}-${language}-${Buffer.from(message).toString('base64')}`;
  }

  get(message, model, language) {
    const key = this.generateKey(message, model, language);
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.response;
  }

  set(message, model, language, response) {
    const key = this.generateKey(message, model, language);
    
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      response,
      timestamp: Date.now()
    });
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

export const responseCache = new ResponseCache();

export function withCache(handler) {
  return async (req, res) => {
    const { message, model, language } = req.body;
    
    const cachedResponse = responseCache.get(message, model, language);
    if (cachedResponse) {
      return res.status(200).json({ 
        response: cachedResponse,
        cached: true 
      });
    }
    
    const originalJson = res.json;
    res.json = function(data) {
      if (data.response && !data.cached) {
        responseCache.set(message, model, language, data.response);
      }
      return originalJson.call(this, data);
    };
    
    return handler(req, res);
  };
}
