const { app } = require('electron')
const fs = require('fs').promises
const path = require('path')

class LocalStorage {
  constructor() {
    this.storagePath = path.join(app.getPath('userData'), 'storage.json')
    this.cache = new Map()
    this.initialized = false
  }

  async init() {
    if (this.initialized) return

    try {
      // 确保存储目录存在
      const storageDir = path.dirname(this.storagePath)
      await fs.mkdir(storageDir, { recursive: true })

      // 尝试读取现有数据
      try {
        const data = await fs.readFile(this.storagePath, 'utf-8')
        const parsed = JSON.parse(data)
        Object.entries(parsed).forEach(([key, value]) => {
          this.cache.set(key, value)
        })
      } catch (error) {
        // 文件不存在或解析失败,创建新文件
        await this.save()
      }

      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize local storage:', error)
      this.initialized = true
    }
  }

  async get(key) {
    await this.init()
    return this.cache.get(key)
  }

  async set(key, value) {
    await this.init()
    this.cache.set(key, value)
    await this.save()
  }

  async delete(key) {
    await this.init()
    this.cache.delete(key)
    await this.save()
  }

  async clear() {
    await this.init()
    this.cache.clear()
    await this.save()
  }

  async save() {
    try {
      const data = Object.fromEntries(this.cache)
      await fs.writeFile(this.storagePath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to save local storage:', error)
    }
  }
}

module.exports = LocalStorage
