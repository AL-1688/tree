/**
 * 上传状态存储
 * 使用加密存储保存上传状态快照，支持断点续传
 */

const { safeStorage } = require('electron')
const fs = require('fs').promises
const path = require('path')
const crypto = require('crypto')

class UploadStateStore {
  constructor(storagePath) {
    this.storagePath = storagePath || path.join(process.cwd(), 'data', 'upload-states')
    this.snapshotInterval = 5000  // 快照间隔 5 秒
    this.lastSnapshotTime = 0
    this.version = '1.0.0'
    this.historyRetentionDays = 30
  }

  /**
   * 初始化存储目录
   */
  async init() {
    try {
      await fs.mkdir(this.storagePath, { recursive: true })
    } catch (error) {
      console.error('Failed to init upload state store:', error)
    }
  }

  /**
   * 加密数据
   * @param {string} data 明文数据
   * @returns {string} 加密后的 Base64 字符串
   */
  encrypt(data) {
    if (!safeStorage.isEncryptionAvailable()) {
      // 如果加密不可用，使用简单的 base64 编码
      return Buffer.from(data).toString('base64')
    }
    const encrypted = safeStorage.encryptString(data)
    return encrypted.toString('base64')
  }

  /**
   * 解密数据
   * @param {string} encryptedData 加密的 Base64 字符串
   * @returns {string} 解密后的数据
   */
  decrypt(encryptedData) {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        return Buffer.from(encryptedData, 'base64').toString('utf-8')
      }
      const buffer = Buffer.from(encryptedData, 'base64')
      return safeStorage.decryptString(buffer)
    } catch (error) {
      console.error('Failed to decrypt data:', error)
      return null
    }
  }

  /**
   * 生成任务 ID
   * @returns {string}
   */
  generateTaskId() {
    const timestamp = Date.now().toString(36)
    const random = crypto.randomBytes(4).toString('hex')
    return `task_${timestamp}_${random}`
  }

  /**
   * 保存任务状态快照
   * @param {Object} task 任务对象
   */
  async saveSnapshot(task) {
    await this.init()

    const snapshot = {
      version: this.version,
      taskId: task.id,
      createdAt: task.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      task: {
        folderPath: task.folderPath,
        owner: task.owner,
        repo: task.repo,
        branch: task.branch,
        targetPath: task.targetPath,
        conflictStrategy: task.conflictStrategy
      },
      files: task.files.map(f => ({
        path: f.path,
        localPath: f.localPath,
        status: f.status,
        size: f.size,
        sha: f.sha,
        error: f.error,
        retryCount: f.retryCount || 0
      })),
      stats: task.stats
    }

    const data = JSON.stringify(snapshot)
    const encrypted = this.encrypt(data)
    const filePath = path.join(this.storagePath, `${task.id}.json`)

    // 原子写入：先写入临时文件，再重命名
    const tempPath = filePath + '.tmp'
    await fs.writeFile(tempPath, encrypted, 'utf-8')
    await fs.rename(tempPath, filePath)

    this.lastSnapshotTime = Date.now()
  }

  /**
   * 加载任务状态快照
   * @param {string} taskId 任务 ID
   * @returns {Object|null} 任务对象
   */
  async loadSnapshot(taskId) {
    try {
      const filePath = path.join(this.storagePath, `${taskId}.json`)
      const encrypted = await fs.readFile(filePath, 'utf-8')
      const decrypted = this.decrypt(encrypted)

      if (!decrypted) {
        return null
      }

      const snapshot = JSON.parse(decrypted)

      // 版本迁移（如果需要）
      if (snapshot.version !== this.version) {
        return this.migrateSnapshot(snapshot)
      }

      return this.snapshotToTask(snapshot)
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to load snapshot:', error)
      }
      return null
    }
  }

  /**
   * 删除任务快照
   * @param {string} taskId 任务 ID
   */
  async deleteSnapshot(taskId) {
    try {
      const filePath = path.join(this.storagePath, `${taskId}.json`)
      await fs.unlink(filePath)
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to delete snapshot:', error)
      }
    }
  }

  /**
   * 获取所有未完成任务
   * @returns {Array} 未完成任务列表
   */
  async getUnfinishedTasks() {
    await this.init()

    const tasks = []
    const files = await fs.readdir(this.storagePath)

    for (const file of files) {
      if (!file.endsWith('.json') || file.endsWith('.tmp')) continue

      const taskId = file.replace('.json', '')
      const task = await this.loadSnapshot(taskId)

      if (task && this.isUnfinishedTask(task)) {
        tasks.push(task)
      }
    }

    return tasks
  }

  /**
   * 判断任务是否未完成
   * @param {Object} task 任务对象
   * @returns {boolean}
   */
  isUnfinishedTask(task) {
    return task.status !== 'completed' && task.status !== 'cancelled'
  }

  /**
   * 快照转任务对象
   * @param {Object} snapshot 快照对象
   * @returns {Object} 任务对象
   */
  snapshotToTask(snapshot) {
    return {
      id: snapshot.taskId,
      status: this.calculateTaskStatus(snapshot.files),
      folderPath: snapshot.task.folderPath,
      owner: snapshot.task.owner,
      repo: snapshot.task.repo,
      branch: snapshot.task.branch,
      targetPath: snapshot.task.targetPath,
      conflictStrategy: snapshot.task.conflictStrategy,
      files: snapshot.files,
      stats: snapshot.stats,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt
    }
  }

  /**
   * 根据文件状态计算任务状态
   * @param {Array} files 文件列表
   * @returns {string} 任务状态
   */
  calculateTaskStatus(files) {
    const hasUploading = files.some(f => f.status === 'uploading')
    const hasPending = files.some(f => f.status === 'pending')
    const hasFailed = files.some(f => f.status === 'failed')
    const allCompleted = files.every(f =>
      f.status === 'completed' || f.status === 'skipped'
    )

    if (allCompleted) return 'completed'
    if (hasUploading) return 'running'
    if (hasFailed && !hasPending && !hasUploading) return 'error'
    return 'pending'
  }

  /**
   * 快照版本迁移
   * @param {Object} snapshot 旧版本快照
   * @returns {Object} 新版本任务对象
   */
  migrateSnapshot(snapshot) {
    // 目前只有一个版本，未来可以在这里处理版本迁移
    return this.snapshotToTask(snapshot)
  }

  /**
   * 添加到历史记录
   * @param {Object} task 任务对象
   */
  async addToHistory(task) {
    await this.init()

    const historyDir = path.join(this.storagePath, 'history')
    await fs.mkdir(historyDir, { recursive: true })

    const historyEntry = {
      id: task.id,
      status: task.status,
      folderPath: task.folderPath,
      owner: task.owner,
      repo: task.repo,
      branch: task.branch,
      totalFiles: task.stats?.totalFiles || 0,
      completedFiles: task.stats?.completedFiles || 0,
      failedFiles: task.stats?.failedFiles || 0,
      createdAt: task.createdAt,
      completedAt: new Date().toISOString()
    }

    const data = JSON.stringify(historyEntry)
    const encrypted = this.encrypt(data)
    const filePath = path.join(historyDir, `${task.id}.json`)

    const tempPath = filePath + '.tmp'
    await fs.writeFile(tempPath, encrypted, 'utf-8')
    await fs.rename(tempPath, filePath)
  }

  /**
   * 获取历史记录
   * @param {Object} params 查询参数
   * @returns {Array} 历史记录列表
   */
  async getHistory(params = {}) {
    await this.init()

    const historyDir = path.join(this.storagePath, 'history')
    let files = []

    try {
      files = await fs.readdir(historyDir)
    } catch (error) {
      if (error.code === 'ENOENT') return []
      throw error
    }

    let history = []
    for (const file of files) {
      if (!file.endsWith('.json') || file.endsWith('.tmp')) continue

      try {
        const filePath = path.join(historyDir, file)
        const encrypted = await fs.readFile(filePath, 'utf-8')
        const decrypted = this.decrypt(encrypted)

        if (decrypted) {
          history.push(JSON.parse(decrypted))
        }
      } catch (err) {
        console.error('Failed to read history entry:', err)
      }
    }

    // 按完成时间倒序排序
    history.sort((a, b) =>
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    )

    // 应用过滤条件
    if (params.owner) {
      history = history.filter(h => h.owner === params.owner)
    }
    if (params.repo) {
      history = history.filter(h => h.repo === params.repo)
    }
    if (params.status) {
      history = history.filter(h => h.status === params.status)
    }
    if (params.startDate) {
      const startDate = new Date(params.startDate)
      history = history.filter(h => new Date(h.completedAt) >= startDate)
    }
    if (params.endDate) {
      const endDate = new Date(params.endDate)
      history = history.filter(h => new Date(h.completedAt) <= endDate)
    }

    // 分页
    const offset = params.offset || 0
    const limit = params.limit || 50

    return history.slice(offset, offset + limit)
  }

  /**
   * 清理过期历史记录
   */
  async cleanupHistory() {
    await this.init()

    const historyDir = path.join(this.storagePath, 'history')
    let files = []

    try {
      files = await fs.readdir(historyDir)
    } catch (error) {
      if (error.code === 'ENOENT') return { deleted: 0 }
      throw error
    }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.historyRetentionDays)

    let deleted = 0
    for (const file of files) {
      if (!file.endsWith('.json') || file.endsWith('.tmp')) continue

      try {
        const filePath = path.join(historyDir, file)
        const encrypted = await fs.readFile(filePath, 'utf-8')
        const decrypted = this.decrypt(encrypted)

        if (decrypted) {
          const entry = JSON.parse(decrypted)
          if (new Date(entry.completedAt) < cutoffDate) {
            await fs.unlink(filePath)
            deleted++
          }
        }
      } catch (err) {
        console.error('Failed to check history entry:', err)
      }
    }

    return { deleted }
  }

  /**
   * 检查是否需要保存快照
   * @returns {boolean}
   */
  shouldSaveSnapshot() {
    return Date.now() - this.lastSnapshotTime >= this.snapshotInterval
  }

  /**
   * 清除所有状态（用于测试）
   */
  async clearAll() {
    try {
      const files = await fs.readdir(this.storagePath)
      for (const file of files) {
        const filePath = path.join(this.storagePath, file)
        const stat = await fs.stat(filePath)
        if (stat.isDirectory()) {
          await fs.rm(filePath, { recursive: true })
        } else {
          await fs.unlink(filePath)
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to clear all states:', error)
      }
    }
  }
}

module.exports = UploadStateStore
