/**
 * 上传队列管理器
 * 维护待上传文件队列，支持优先级排序
 */

class UploadQueue {
  constructor() {
    this.items = []
    this.currentIndex = 0
  }

  /**
   * 添加文件到队列
   * @param {Array} items 文件列表
   * @param {number} priority 优先级（数字越大越优先）
   */
  enqueue(items, priority = 0) {
    const queueItems = items.map(item => ({
      ...item,
      priority,
      retryCount: 0,
      addedAt: Date.now()
    }))

    this.items.push(...queueItems)
    this.sort()
  }

  /**
   * 获取下一个待上传文件
   * @returns {Object | null}
   */
  dequeue() {
    if (this.items.length === 0) return null

    // 找到第一个 pending 状态的文件
    const index = this.items.findIndex(item => item.status === 'pending')
    if (index === -1) return null

    const item = this.items[index]
    item.status = 'uploading'
    return item
  }

  /**
   * 标记文件完成
   * @param {string} filePath 文件路径
   * @param {string} sha 文件 SHA
   */
  markCompleted(filePath, sha) {
    const item = this.items.find(i => i.path === filePath)
    if (item) {
      item.status = 'completed'
      item.sha = sha
      item.completedAt = Date.now()
    }
  }

  /**
   * 标记文件失败
   * @param {string} filePath 文件路径
   * @param {string} error 错误信息
   */
  markFailed(filePath, error) {
    const item = this.items.find(i => i.path === filePath)
    if (item) {
      item.status = 'failed'
      item.error = error
      item.failedAt = Date.now()
    }
  }

  /**
   * 标记文件跳过
   * @param {string} filePath 文件路径
   */
  markSkipped(filePath) {
    const item = this.items.find(i => i.path === filePath)
    if (item) {
      item.status = 'skipped'
      item.skippedAt = Date.now()
    }
  }

  /**
   * 重新入队失败文件
   * @param {string[]} filePaths 文件路径列表
   */
  requeueFailed(filePaths) {
    filePaths.forEach(filePath => {
      const item = this.items.find(i => i.path === filePath && i.status === 'failed')
      if (item) {
        item.status = 'pending'
        item.retryCount++
        item.error = null
      }
    })
    this.sort()
  }

  /**
   * 获取队列状态
   * @returns {Object}
   */
  getStatus() {
    return {
      total: this.items.length,
      pending: this.items.filter(i => i.status === 'pending').length,
      uploading: this.items.filter(i => i.status === 'uploading').length,
      completed: this.items.filter(i => i.status === 'completed').length,
      failed: this.items.filter(i => i.status === 'failed').length,
      skipped: this.items.filter(i => i.status === 'skipped').length
    }
  }

  /**
   * 获取统计信息
   * @returns {Object}
   */
  getStats() {
    const completedItems = this.items.filter(i => i.status === 'completed')
    const failedItems = this.items.filter(i => i.status === 'failed')
    const pendingItems = this.items.filter(i => i.status === 'pending')

    return {
      totalFiles: this.items.length,
      totalSize: this.items.reduce((sum, i) => sum + (i.size || 0), 0),
      completedFiles: completedItems.length,
      completedSize: completedItems.reduce((sum, i) => sum + (i.size || 0), 0),
      failedFiles: failedItems.length,
      skippedFiles: this.items.filter(i => i.status === 'skipped').length
    }
  }

  /**
   * 获取所有失败文件
   * @returns {Array}
   */
  getFailedFiles() {
    return this.items.filter(i => i.status === 'failed')
  }

  /**
   * 获取所有待上传文件
   * @returns {Array}
   */
  getPendingFiles() {
    return this.items.filter(i => i.status === 'pending')
  }

  /**
   * 按优先级排序
   */
  sort() {
    this.items.sort((a, b) => {
      // 优先级高的排前面
      if (a.priority !== b.priority) {
        return b.priority - a.priority
      }
      // 相同优先级，先加入的排前面
      return a.addedAt - b.addedAt
    })
  }

  /**
   * 清空队列
   */
  clear() {
    this.items = []
    this.currentIndex = 0
  }

  /**
   * 导出队列状态（用于持久化）
   * @returns {Array}
   */
  export() {
    return this.items.map(item => ({
      path: item.path,
      localPath: item.localPath,
      size: item.size,
      status: item.status,
      sha: item.sha,
      error: item.error,
      retryCount: item.retryCount
    }))
  }

  /**
   * 导入队列状态（用于恢复）
   * @param {Array} items 队列项
   */
  import(items) {
    this.items = items.map(item => ({
      ...item,
      addedAt: Date.now()
    }))
    this.sort()
  }
}

module.exports = UploadQueue
