/**
 * 离线缓存管理模块
 * 提供本地数据缓存功能,支持离线访问
 */

const fs = require('fs').promises
const path = require('path')
const { app } = require('electron')

class CacheManager {
  constructor() {
    this.cacheDir = path.join(app.getPath('userData'), 'cache')
    this.metadataFile = path.join(this.cacheDir, 'metadata.json')
    this.metadata = new Map()
    this.initialized = false
  }

  /**
   * 初始化缓存管理器
   */
  async init() {
    if (this.initialized) return

    try {
      // 创建缓存目录
      await fs.mkdir(this.cacheDir, { recursive: true })

      // 加载元数据
      try {
        const data = await fs.readFile(this.metadataFile, 'utf-8')
        const parsed = JSON.parse(data)
        Object.entries(parsed).forEach(([key, value]) => {
          this.metadata.set(key, value)
        })
      } catch (error) {
        // 文件不存在,创建新的
        await this.saveMetadata()
      }

      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize cache manager:', error)
      this.initialized = true
    }
  }

  /**
   * 获取缓存
   * @param {string} key - 缓存键
   * @returns {Promise<any>} 缓存数据
   */
  async get(key) {
    await this.init()

    try {
      const meta = this.metadata.get(key)

      if (!meta) {
        return null
      }

      // 检查是否过期
      if (meta.expires && Date.now() > meta.expires) {
        await this.delete(key)
        return null
      }

      // 读取缓存文件
      const cacheFile = path.join(this.cacheDir, meta.filename)
      const data = await fs.readFile(cacheFile, 'utf-8')

      // 更新访问时间
      meta.lastAccessed = Date.now()
      await this.saveMetadata()

      return JSON.parse(data)
    } catch (error) {
      return null
    }
  }

  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {any} data - 缓存数据
   * @param {number} ttl - 过期时间(毫秒)
   */
  async set(key, data, ttl = 3600000) {
    await this.init()

    try {
      const filename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`
      const cacheFile = path.join(this.cacheDir, filename)

      // 写入缓存文件
      await fs.writeFile(cacheFile, JSON.stringify(data), 'utf-8')

      // 更新元数据
      this.metadata.set(key, {
        filename,
        created: Date.now(),
        lastAccessed: Date.now(),
        expires: ttl ? Date.now() + ttl : null,
        size: JSON.stringify(data).length
      })

      await this.saveMetadata()
    } catch (error) {
      console.error('Failed to set cache:', error)
    }
  }

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   */
  async delete(key) {
    await this.init()

    try {
      const meta = this.metadata.get(key)

      if (meta) {
        // 删除缓存文件
        const cacheFile = path.join(this.cacheDir, meta.filename)
        await fs.unlink(cacheFile).catch(() => {})

        // 删除元数据
        this.metadata.delete(key)
        await this.saveMetadata()
      }
    } catch (error) {
      console.error('Failed to delete cache:', error)
    }
  }

  /**
   * 清空所有缓存
   */
  async clear() {
    await this.init()

    try {
      // 删除所有缓存文件
      for (const [key, meta] of this.metadata) {
        const cacheFile = path.join(this.cacheDir, meta.filename)
        await fs.unlink(cacheFile).catch(() => {})
      }

      // 清空元数据
      this.metadata.clear()
      await this.saveMetadata()
    } catch (error) {
      console.error('Failed to clear cache:', error)
    }
  }

  /**
   * 清理过期缓存
   */
  async cleanup() {
    await this.init()

    const now = Date.now()
    const expiredKeys = []

    for (const [key, meta] of this.metadata) {
      if (meta.expires && now > meta.expires) {
        expiredKeys.push(key)
      }
    }

    // 删除过期缓存
    for (const key of expiredKeys) {
      await this.delete(key)
    }

    return expiredKeys.length
  }

  /**
   * 获取缓存统计信息
   */
  async getStats() {
    await this.init()

    let totalSize = 0
    let totalFiles = this.metadata.size

    for (const [, meta] of this.metadata) {
      totalSize += meta.size || 0
    }

    return {
      totalFiles,
      totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      cacheDir: this.cacheDir
    }
  }

  /**
   * 保存元数据
   */
  async saveMetadata() {
    try {
      const data = Object.fromEntries(this.metadata)
      await fs.writeFile(this.metadataFile, JSON.stringify(data, null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to save metadata:', error)
    }
  }
}

module.exports = CacheManager
