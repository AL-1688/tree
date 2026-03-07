/**
 * 缓存工具类 - 用于前端缓存管理
 */

// 默认缓存时间（毫秒）
const DEFAULT_TTL = {
  repositories: 5 * 60 * 1000,      // 仓库列表缓存 5 分钟
  repository: 10 * 60 * 1000,       // 单个仓库缓存 10 分钟
  searchResults: 3 * 60 * 1000,     // 搜索结果缓存 3 分钟
  userInfo: 30 * 60 * 1000,         // 用户信息缓存 30 分钟
  fileContent: 60 * 60 * 1000       // 文件内容缓存 1 小时
}

/**
 * 生成缓存键
 */
export function generateCacheKey(type, ...parts) {
  return `cache:${type}:${parts.join(':')}`
}

/**
 * 获取缓存数据
 * @param {string} key 缓存键
 * @returns {Promise<any|null>} 缓存数据或 null
 */
export async function getCache(key) {
  try {
    const data = await window.electronAPI.cache.get(key)
    return data
  } catch (error) {
    console.warn('Failed to get cache:', error)
    return null
  }
}

/**
 * 设置缓存数据
 * @param {string} key 缓存键
 * @param {any} data 要缓存的数据
 * @param {number} ttl 过期时间（毫秒）
 */
export async function setCache(key, data, ttl = DEFAULT_TTL.repositories) {
  try {
    await window.electronAPI.cache.set(key, data, ttl)
  } catch (error) {
    console.warn('Failed to set cache:', error)
  }
}

/**
 * 删除缓存数据
 * @param {string} key 缓存键
 */
export async function deleteCache(key) {
  try {
    await window.electronAPI.cache.delete(key)
  } catch (error) {
    console.warn('Failed to delete cache:', error)
  }
}

/**
 * 清空所有缓存
 */
export async function clearCache() {
  try {
    await window.electronAPI.cache.clear()
  } catch (error) {
    console.warn('Failed to clear cache:', error)
  }
}

/**
 * 清理过期缓存
 */
export async function cleanupCache() {
  try {
    const result = await window.electronAPI.cache.cleanup()
    return result
  } catch (error) {
    console.warn('Failed to cleanup cache:', error)
    return { removed: 0 }
  }
}

/**
 * 获取缓存统计信息
 */
export async function getCacheStats() {
  try {
    const stats = await window.electronAPI.cache.stats()
    return stats
  } catch (error) {
    console.warn('Failed to get cache stats:', error)
    return { count: 0, totalSize: 0 }
  }
}

/**
 * 带缓存的 API 调用包装器
 * @param {string} cacheKey 缓存键
 * @param {Function} fetchFn 数据获取函数
 * @param {number} ttl 过期时间
 * @param {boolean} forceRefresh 是否强制刷新
 */
export async function fetchWithCache(cacheKey, fetchFn, ttl, forceRefresh = false) {
  // 如果不是强制刷新，先尝试从缓存获取
  if (!forceRefresh) {
    const cachedData = await getCache(cacheKey)
    if (cachedData !== null) {
      return cachedData
    }
  }

  // 从 API 获取数据
  const data = await fetchFn()

  // 缓存数据
  await setCache(cacheKey, data, ttl)

  return data
}

export { DEFAULT_TTL }
