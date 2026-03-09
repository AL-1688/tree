/**
 * 上传管理器
 * 统筹管理所有上传任务，协调队列、并发控制器、状态存储
 */

const { EventEmitter } = require('events')
const UploadQueue = require('./upload-queue')
const ConcurrencyController = require('./concurrency-controller')
const UploadStateStore = require('./upload-state-store')
const ConflictDetector = require('./conflict-detector')
const LargeFileHandler = require('./large-file-handler')
const path = require('path')
const fs = require('fs').promises

class UploadManager extends EventEmitter {
  constructor(options = {}) {
    super()
    this.options = options
    this.tasks = new Map()
    this.queue = new UploadQueue()
    this.concurrencyController = new ConcurrencyController(options.maxConcurrency || 3)
    this.stateStore = new UploadStateStore(options.storagePath)
    this.conflictDetector = null
    this.largeFileHandler = null
    this.gitHubAPI = options.gitHubAPI
    this.chunkUploader = options.chunkUploader

    // 重试配置
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2
    }

    // 状态
    this.isRunning = false
    this.currentProcessingCount = 0
  }

  /**
   * 初始化管理器
   */
  async init() {
    await this.stateStore.init()

    if (this.gitHubAPI) {
      this.conflictDetector = new ConflictDetector(this.gitHubAPI)
    }

    if (this.chunkUploader) {
      this.largeFileHandler = new LargeFileHandler({
        chunkUploader: this.chunkUploader,
        threshold: this.options.largeFileThreshold || 50 * 1024 * 1024
      })
    }

    // 恢复未完成的任务
    const unfinishedTasks = await this.stateStore.getUnfinishedTasks()
    for (const task of unfinishedTasks) {
      this.tasks.set(task.id, task)
      this.emit('task:recovered', task)
    }

    return unfinishedTasks
  }

  /**
   * 设置 GitHub API
   * @param {Object} gitHubAPI GitHub API 实例
   */
  setGitHubAPI(gitHubAPI) {
    this.gitHubAPI = gitHubAPI
    this.conflictDetector = new ConflictDetector(gitHubAPI)
  }

  /**
   * 设置分块上传器
   * @param {Object} chunkUploader ChunkUploader 实例
   */
  setChunkUploader(chunkUploader) {
    this.chunkUploader = chunkUploader
    this.largeFileHandler = new LargeFileHandler({
      chunkUploader,
      threshold: this.options.largeFileThreshold || 50 * 1024 * 1024
    })
  }

  /**
   * 创建上传任务
   * @param {Object} params 任务参数
   * @returns {Object} 任务对象
   */
  async createTask(params) {
    const { folderPath, owner, repo, branch, targetPath, conflictStrategy } = params

    // 读取文件夹结构
    const files = await this.readFolderFiles(folderPath, targetPath)

    // 创建任务对象
    const task = {
      id: this.stateStore.generateTaskId(),
      status: 'pending',
      folderPath,
      owner,
      repo,
      branch: branch || 'main',
      targetPath: targetPath || '',
      conflictStrategy: conflictStrategy || 'overwrite',
      files: files.map(f => ({
        path: f.relativePath,
        localPath: f.fullPath,
        status: 'pending',
        size: f.size,
        sha: null,
        error: null,
        retryCount: 0
      })),
      stats: {
        totalFiles: files.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        completedFiles: 0,
        completedSize: 0,
        failedFiles: 0,
        skippedFiles: 0,
        uploadSpeed: 0,
        estimatedTime: 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // 保存任务
    this.tasks.set(task.id, task)
    await this.stateStore.saveSnapshot(task)

    this.emit('task:created', task)
    return task
  }

  /**
   * 读取文件夹中的所有文件
   * @param {string} folderPath 文件夹路径
   * @param {string} targetPath 目标路径
   * @returns {Array} 文件列表
   */
  async readFolderFiles(folderPath, targetPath) {
    const files = []
    const MAX_DEPTH = 50  // 最大目录深度
    const MAX_FILES = 10000  // 最大文件数量

    const readDir = async (dirPath, relativePath = '', depth = 0) => {
      // 检查深度限制
      if (depth > MAX_DEPTH) {
        console.warn(`Max directory depth (${MAX_DEPTH}) reached: ${dirPath}`)
        return
      }

      // 检查文件数量限制
      if (files.length >= MAX_FILES) {
        console.warn(`Max files limit (${MAX_FILES}) reached`)
        return
      }

      let entries
      try {
        entries = await fs.readdir(dirPath, { withFileTypes: true })
      } catch (error) {
        console.warn(`Failed to read directory: ${dirPath}`, error.message)
        return
      }

      for (const entry of entries) {
        // 检查文件数量限制
        if (files.length >= MAX_FILES) {
          console.warn(`Max files limit (${MAX_FILES}) reached`)
          return
        }

        const fullEntryPath = path.join(dirPath, entry.name)
        const relativeEntryPath = path.join(relativePath, entry.name)

        // 跳过隐藏文件和特殊目录
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue
        }

        if (entry.isDirectory()) {
          await readDir(fullEntryPath, relativeEntryPath, depth + 1)
        } else if (entry.isFile()) {
          try {
            const stat = await fs.stat(fullEntryPath)
            files.push({
              name: entry.name,
              fullPath: fullEntryPath,
              relativePath: relativeEntryPath,
              size: stat.size
            })
          } catch (error) {
            console.warn(`Failed to stat file: ${fullEntryPath}`, error.message)
          }
        }
      }
    }

    await readDir(folderPath)
    return files
  }

  /**
   * 检测文件冲突
   * @param {string} taskId 任务 ID
   * @returns {Object} 冲突检测结果
   */
  async checkConflict(taskId) {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error('Task not found')
    }

    if (!this.conflictDetector) {
      throw new Error('Conflict detector not initialized')
    }

    const files = task.files
      .filter(f => f.status === 'pending')
      .map(f => ({ path: f.path, localPath: f.localPath, size: f.size }))

    const result = await this.conflictDetector.detect({
      owner: task.owner,
      repo: task.repo,
      branch: task.branch,
      files,
      targetPath: task.targetPath
    })

    // 更新任务中的冲突信息
    for (const conflict of result.conflicts) {
      const file = task.files.find(f => f.path === conflict.path)
      if (file) {
        file.conflict = conflict
      }
    }

    // 标记相同文件为可跳过
    for (const filePath of result.identicalFiles) {
      const file = task.files.find(f => f.path === filePath)
      if (file) {
        file.canSkip = true
      }
    }

    return result
  }

  /**
   * 启动任务
   * @param {string} taskId 任务 ID
   */
  async startTask(taskId) {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error('Task not found')
    }

    task.status = 'running'
    task.updatedAt = new Date().toISOString()
    await this.stateStore.saveSnapshot(task)

    // 将文件添加到队列
    const pendingFiles = task.files.filter(f => f.status === 'pending')
    this.queue.enqueue(pendingFiles.map(f => ({
      path: f.path,
      localPath: f.localPath,
      size: f.size,
      priority: 0,
      retryCount: f.retryCount,
      taskId
    })))

    this.emit('task:started', task)

    // 开始处理队列
    if (!this.isRunning) {
      this.processQueue()
    }
  }

  /**
   * 处理上传队列
   */
  async processQueue() {
    if (this.isRunning) return
    this.isRunning = true

    // 添加最大迭代次数限制，防止极端情况下的无限循环
    const MAX_ITERATIONS = 100000
    let iterations = 0

    while (!this.queue.isEmpty() && iterations < MAX_ITERATIONS) {
      iterations++
      const item = this.queue.dequeue()
      if (!item) break

      const task = this.tasks.get(item.taskId)
      if (!task || task.status === 'paused' || task.status === 'cancelled') {
        continue
      }

      // 获取上传槽位
      const slotId = await this.concurrencyController.acquireSlot()
      this.currentProcessingCount++

      // 异步处理单个文件，添加错误通知
      this.processFile(task, item, slotId).catch(error => {
        console.error('Error processing file:', error)
        // 发送文件错误事件
        this.emit('file:error', {
          taskId: item.taskId,
          filePath: item.path,
          error: error.message
        })
      })
    }

    if (iterations >= MAX_ITERATIONS) {
      console.warn('Process queue reached max iterations limit')
    }

    this.isRunning = false
  }

  /**
   * 处理单个文件上传
   * @param {Object} task 任务对象
   * @param {Object} item 队列项
   * @param {number} slotId 槽位 ID
   */
  async processFile(task, item, slotId) {
    const file = task.files.find(f => f.path === item.path)
    if (!file) {
      this.concurrencyController.releaseSlot(slotId, false)
      this.currentProcessingCount--
      return
    }

    const startTime = Date.now()
    file.status = 'uploading'
    this.emitProgress(task)

    try {
      // 执行上传
      const result = await this.uploadFile(task, file)

      const responseTime = Date.now() - startTime

      if (result.success) {
        file.status = 'completed'
        file.sha = result.sha || result.content?.sha
        task.stats.completedFiles++
        task.stats.completedSize += file.size

        this.concurrencyController.releaseSlot(slotId, true, responseTime)
        this.emitProgress(task)
      } else {
        throw new Error(result.error || 'Upload failed')
      }
    } catch (error) {
      file.status = 'failed'
      file.error = error.message
      file.retryCount++

      task.stats.failedFiles++

      this.concurrencyController.releaseSlot(slotId, false, Date.now() - startTime)
      this.emitProgress(task)
    }

    this.currentProcessingCount--

    // 检查任务是否完成
    this.checkTaskCompletion(task)

    // 定期保存快照
    if (this.stateStore.shouldSaveSnapshot()) {
      await this.stateStore.saveSnapshot(task)
    }
  }

  /**
   * 上传单个文件
   * @param {Object} task 任务对象
   * @param {Object} file 文件对象
   * @returns {Object} 上传结果
   */
  async uploadFile(task, file) {
    if (!this.gitHubAPI) {
      throw new Error('GitHub API not initialized')
    }

    const targetPath = task.targetPath
      ? `${task.targetPath}/${file.path}`
      : file.path

    // 检查是否需要分块上传
    if (this.largeFileHandler && this.chunkUploader) {
      const strategy = this.largeFileHandler.checkStrategy(file.size)

      if (strategy.type === 'chunk' || strategy.type === 'lfs-recommended') {
        // 使用分块上传
        const result = await this.chunkUploader.uploadLargeFile({
          owner: task.owner,
          repo: task.repo,
          filePath: file.localPath,
          targetPath,
          message: `Upload ${file.path}`,
          branch: task.branch
        }, (progress) => {
          this.emit('file:progress', {
            taskId: task.id,
            filePath: file.path,
            progress
          })
        })

        return result
      }
    }

    // 普通上传
    const content = await fs.readFile(file.localPath)
    const base64Content = content.toString('base64')

    // 获取远程文件 SHA（如果存在）
    let sha = null
    try {
      const remoteFile = await this.gitHubAPI.getRepositoryContent({
        owner: task.owner,
        repo: task.repo,
        path: targetPath,
        ref: task.branch
      })
      if (remoteFile && remoteFile.sha) {
        sha = remoteFile.sha
      }
    } catch (error) {
      // 文件不存在，忽略
    }

    // 处理冲突策略
    if (sha && task.conflictStrategy === 'skip') {
      return { success: true, skipped: true }
    }

    return await this.gitHubAPI.uploadFile({
      owner: task.owner,
      repo: task.repo,
      path: targetPath,
      message: `Upload ${file.path}`,
      content: base64Content,
      branch: task.branch,
      sha: task.conflictStrategy === 'overwrite' ? sha : null
    })
  }

  /**
   * 检查任务是否完成
   * @param {Object} task 任务对象
   */
  checkTaskCompletion(task) {
    const hasUploading = task.files.some(f => f.status === 'uploading')
    const hasPending = task.files.some(f => f.status === 'pending')

    if (!hasUploading && !hasPending) {
      const hasFailed = task.files.some(f => f.status === 'failed')

      if (hasFailed) {
        task.status = 'error'
        this.emit('task:error', task)
      } else {
        task.status = 'completed'
        this.emit('task:complete', task)
      }

      task.updatedAt = new Date().toISOString()

      // 保存到历史记录
      this.stateStore.addToHistory(task)
      this.stateStore.deleteSnapshot(task.id)
    }
  }

  /**
   * 发送进度更新
   * @param {Object} task 任务对象
   */
  emitProgress(task) {
    const progress = this.getProgress(task.id)
    this.emit('progress', progress)
  }

  /**
   * 暂停任务
   * @param {string} taskId 任务 ID
   */
  async pauseTask(taskId) {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error('Task not found')
    }

    if (task.status !== 'running') {
      throw new Error('Task is not running')
    }

    task.status = 'paused'
    task.updatedAt = new Date().toISOString()

    // 使用 Promise 和事件驱动等待当前上传完成
    if (this.currentProcessingCount > 0) {
      await new Promise((resolve) => {
        const checkComplete = () => {
          if (this.currentProcessingCount === 0) {
            this.off('file:complete', checkComplete)
            this.off('file:error', checkComplete)
            resolve()
          }
        }

        // 监听文件完成/错误事件
        this.on('file:complete', checkComplete)
        this.on('file:error', checkComplete)

        // 设置超时防止永久等待
        setTimeout(() => {
          this.off('file:complete', checkComplete)
          this.off('file:error', checkComplete)
          resolve()
        }, 30000) // 30 秒超时
      })
    }

    await this.stateStore.saveSnapshot(task)
    this.emit('task:paused', task)
  }

  /**
   * 恢复任务
   * @param {string} taskId 任务 ID
   */
  async resumeTask(taskId) {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error('Task not found')
    }

    if (task.status !== 'paused') {
      throw new Error('Task is not paused')
    }

    task.status = 'running'
    task.updatedAt = new Date().toISOString()

    // 将待处理文件重新加入队列
    const pendingFiles = task.files.filter(f => f.status === 'pending' || f.status === 'failed')
    this.queue.enqueue(pendingFiles.map(f => ({
      path: f.path,
      localPath: f.localPath,
      size: f.size,
      priority: 0,
      retryCount: f.retryCount,
      taskId
    })))

    await this.stateStore.saveSnapshot(task)
    this.emit('task:resumed', task)

    if (!this.isRunning) {
      this.processQueue()
    }
  }

  /**
   * 取消任务
   * @param {string} taskId 任务 ID
   */
  async cancelTask(taskId) {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error('Task not found')
    }

    task.status = 'cancelled'
    task.updatedAt = new Date().toISOString()

    // 清空队列中属于该任务的文件
    this.queue.clear()

    // 等待当前上传完成
    while (this.currentProcessingCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    await this.stateStore.deleteSnapshot(taskId)
    this.emit('task:cancelled', task)
  }

  /**
   * 重试失败文件
   * @param {string} taskId 任务 ID
   * @param {Array} filePaths 可选，指定文件路径
   */
  async retryFailed(taskId, filePaths) {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error('Task not found')
    }

    const failedFiles = filePaths
      ? task.files.filter(f => filePaths.includes(f.path) && f.status === 'failed')
      : task.files.filter(f => f.status === 'failed')

    if (failedFiles.length === 0) {
      return { retried: 0 }
    }

    // 重置失败文件状态
    for (const file of failedFiles) {
      file.status = 'pending'
      file.error = null
      task.stats.failedFiles--
    }

    // 加入队列
    this.queue.enqueue(failedFiles.map(f => ({
      path: f.path,
      localPath: f.localPath,
      size: f.size,
      priority: 1,  // 重试优先级更高
      retryCount: f.retryCount,
      taskId
    })))

    if (task.status === 'error') {
      task.status = 'running'
    }

    await this.stateStore.saveSnapshot(task)

    if (!this.isRunning) {
      this.processQueue()
    }

    return { retried: failedFiles.length }
  }

  /**
   * 获取任务进度
   * @param {string} taskId 任务 ID
   * @returns {Object} 进度信息
   */
  getProgress(taskId) {
    const task = this.tasks.get(taskId)
    if (!task) {
      return null
    }

    const currentFiles = task.files
      .filter(f => f.status === 'uploading')
      .map(f => f.path)

    // 计算上传速度（简化版本，可以优化）
    const speed = this.calculateSpeed(task)
    const estimatedTime = speed > 0
      ? Math.ceil((task.stats.totalSize - task.stats.completedSize) / speed)
      : 0

    return {
      taskId,
      status: task.status,
      stats: {
        ...task.stats,
        uploadSpeed: speed,
        estimatedTime
      },
      currentFiles,
      progress: task.stats.totalSize > 0
        ? Math.round((task.stats.completedSize / task.stats.totalSize) * 100)
        : 0
    }
  }

  /**
   * 计算上传速度
   * @param {Object} task 任务对象
   * @returns {number} 字节/秒
   */
  calculateSpeed(task) {
    // 简化实现，可以从并发控制器获取平均响应时间
    const avgResponseTime = this.concurrencyController.getAverageResponseTime()
    if (avgResponseTime === 0) return 0

    // 假设平均文件大小
    const avgFileSize = task.stats.completedFiles > 0
      ? task.stats.completedSize / task.stats.completedFiles
      : 0

    return avgFileSize / (avgResponseTime / 1000) * this.concurrencyController.maxConcurrency
  }

  /**
   * 获取所有任务
   * @returns {Array} 任务列表
   */
  getTasks() {
    return Array.from(this.tasks.values()).map(task => ({
      id: task.id,
      status: task.status,
      folderPath: task.folderPath,
      owner: task.owner,
      repo: task.repo,
      branch: task.branch,
      targetPath: task.targetPath,
      stats: task.stats,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    }))
  }

  /**
   * 设置并发数
   * @param {number} value 并发数
   */
  setConcurrency(value) {
    this.concurrencyController.setMaxConcurrency(value)
  }

  /**
   * 设置自适应并发
   * @param {boolean} enabled 是否启用
   */
  setAutoAdjustConcurrency(enabled) {
    this.concurrencyController.setAutoAdjust(enabled)
  }

  /**
   * 获取并发状态
   * @returns {Object} 并发状态
   */
  getConcurrencyStatus() {
    return this.concurrencyController.getStatus()
  }
}

module.exports = UploadManager
