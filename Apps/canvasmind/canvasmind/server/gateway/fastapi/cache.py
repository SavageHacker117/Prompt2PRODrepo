# minimal in-memory cache placeholder
_cache = {}

def set(key, value): _cache[key] = value
def get(key, default=None): return _cache.get(key, default)
def clear(): _cache.clear()
