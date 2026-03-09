const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const GitHubOAuth = require('./auth/github-oauth')
const GitHubAPI = require('./api/github-api')
const FolderReader = require('./fs/folder-reader')
const LocalStorage = require('./storage/local-storage')
const CacheManager = require('./cache/cache-manager')
const ChunkUploader = require('./upload/chunk-uploader')
const UploadManager = require('./upload/upload-manager')

let mainWindow
let oAuth
let gitHubAPI
let cacheManager
let localStorage
let chunkUploader
let uploadManager

// 开发环境检测
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'GitHub Client',
    show: false,
    backgroundColor: '#ffffff'
  })

  // 窗口准备好后再显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // 加载应用
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/renderer/index.html'))
  }

  // 初始化模块
  oAuth = new GitHubOAuth()
  localStorage = new LocalStorage()
  cacheManager = new CacheManager()
}

// 应用准备就绪
app.whenReady().then(createWindow)

// 所有窗口关闭时退出应用 (Windows & Linux)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// macOS 激活应用时重新创建窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// ========== IPC 处理器 ==========

/**
 * 统一错误处理函数
 * @param {Error} error 错误对象
 * @param {string} operation 操作名称（用于日志）
 * @returns {Object} 标准化的错误响应
 */
function handleIPCError(error, operation) {
  console.error(`${operation} error:`, error)
  // 返回通用错误消息，避免泄露敏感信息
  const safeMessage = error.message.includes('timeout') ? 'Operation timed out' :
                      error.message.includes('not found') ? 'Resource not found' :
                      error.message.includes('invalid') ? 'Invalid request' :
                      'Operation failed'
  return { success: false, error: safeMessage }
}

// OAuth 认证相关
ipcMain.handle('auth:login', async (event, config) => {
  try {
    if (config) {
      oAuth.setConfig(config.clientId, config.clientSecret)
    }
    const result = await oAuth.authenticate()
    if (result.success) {
      gitHubAPI = new GitHubAPI(result.accessToken)
      chunkUploader = new ChunkUploader(result.accessToken)

      // 更新上传管理器的 API 实例
      if (uploadManager) {
        uploadManager.setGitHubAPI(gitHubAPI)
        uploadManager.setChunkUploader(chunkUploader)
      }
    }
    return result
  } catch (error) {
    return handleIPCError(error, 'OAuth login')
  }
})

ipcMain.handle('auth:logout', async () => {
  try {
    await oAuth.logout()
    gitHubAPI = null
    chunkUploader = null

    // 清除上传管理器的 API 实例
    if (uploadManager) {
      uploadManager.setGitHubAPI(null)
      uploadManager.setChunkUploader(null)
    }
    return { success: true }
  } catch (error) {
    return handleIPCError(error, 'Auth logout')
  }
})

ipcMain.handle('auth:getStoredToken', async () => {
  try {
    const token = await oAuth.getStoredToken()
    if (token) {
      gitHubAPI = new GitHubAPI(token)
      chunkUploader = new ChunkUploader(token)

      // 更新上传管理器的 API 实例
      if (uploadManager) {
        uploadManager.setGitHubAPI(gitHubAPI)
        uploadManager.setChunkUploader(chunkUploader)
      }
    }
    return token
  } catch (error) {
    return null
  }
})

// GitHub API 相关
ipcMain.handle('api:getCurrentUser', async () => {
  if (!gitHubAPI) {
    throw new Error('Not authenticated')
  }
  return await gitHubAPI.getCurrentUser()
})

ipcMain.handle('api:getRepositories', async (event, params) => {
  if (!gitHubAPI) {
    throw new Error('Not authenticated')
  }
  return await gitHubAPI.getRepositories(params)
})

ipcMain.handle('api:getRepository', async (event, owner, repo) => {
  if (!gitHubAPI) {
    throw new Error('Not authenticated')
  }
  return await gitHubAPI.getRepository(owner, repo)
})

ipcMain.handle('api:createRepository', async (event, params) => {
  if (!gitHubAPI) {
    throw new Error('Not authenticated')
  }
  return await gitHubAPI.createRepository(params)
})

ipcMain.handle('api:updateRepository', async (event, owner, repo, params) => {
  if (!gitHubAPI) {
    throw new Error('Not authenticated')
  }
  return await gitHubAPI.updateRepository(owner, repo, params)
})

ipcMain.handle('api:deleteRepository', async (event, owner, repo) => {
  if (!gitHubAPI) {
    throw new Error('Not authenticated')
  }
  return await gitHubAPI.deleteRepository(owner, repo)
})

ipcMain.handle('api:getRepositoryContent', async (event, params) => {
  if (!gitHubAPI) {
    throw new Error('Not authenticated')
  }
  return await gitHubAPI.getRepositoryContent(params)
})

ipcMain.handle('api:getFileContent', async (event, params) => {
  if (!gitHubAPI) {
    throw new Error('Not authenticated')
  }
  return await gitHubAPI.getFileContent(params)
})

ipcMain.handle('api:uploadFile', async (event, params) => {
  if (!gitHubAPI) {
    throw new Error('Not authenticated')
  }
  return await gitHubAPI.uploadFile(params)
})

ipcMain.handle('api:deleteFile', async (event, params) => {
  if (!gitHubAPI) {
    throw new Error('Not authenticated')
  }
  return await gitHubAPI.deleteFile(params)
})

ipcMain.handle('api:updateFile', async (event, params) => {
  if (!gitHubAPI) {
    throw new Error('Not authenticated')
  }
  return await gitHubAPI.updateFile(params)
})

// 搜索相关
ipcMain.handle('api:searchRepositories', async (event, params) => {
  if (!gitHubAPI) {
    throw new Error('Not authenticated')
  }
  return await gitHubAPI.searchRepositories(params)
})

ipcMain.handle('api:forkRepository', async (event, owner, repo) => {
  if (!gitHubAPI) {
    throw new Error('Not authenticated')
  }
  return await gitHubAPI.forkRepository(owner, repo)
})

// 下载相关
ipcMain.handle('download:gitClone', async (event, cloneUrl, targetPath) => {
  const { execFile } = require('child_process')
  const path = require('path')
  const fs = require('fs')

  // 验证 cloneUrl 是否为合法的 Git URL
  const GIT_URL_PATTERN = /^https?:\/\/[^\s<>"]+\.git$|^(git@)[^\s<>":]+\.git$|^https?:\/\/[^\s<>"]+\/[\w.-]+\/[\w.-]+$/
  if (!GIT_URL_PATTERN.test(cloneUrl)) {
    throw new Error('Invalid git clone URL')
  }

  // 验证并规范化目标路径
  const normalizedPath = path.normalize(targetPath)
  if (normalizedPath.includes('..') || path.isAbsolute(normalizedPath) === false && !normalizedPath.startsWith(process.cwd())) {
    // 使用用户的下载目录作为基准
    const downloadsPath = app.getPath('downloads')
    const resolvedPath = path.resolve(downloadsPath, normalizedPath)
    if (!resolvedPath.startsWith(downloadsPath)) {
      throw new Error('Invalid target path: path traversal detected')
    }
    targetPath = resolvedPath
  }

  // 确保目标目录存在
  const targetDir = path.dirname(targetPath)
  try {
    await fs.promises.mkdir(targetDir, { recursive: true })
  } catch (err) {
    // 目录已存在，忽略错误
  }

  return new Promise((resolve, reject) => {
    // 使用 execFile 避免 shell 注入
    execFile('git', ['clone', cloneUrl, targetPath], { timeout: 300000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error('Git clone failed'))
      } else {
        resolve({ success: true, path: targetPath })
      }
    })
  })
})

ipcMain.handle('download:downloadZip', async (event, repoUrl, targetPath) => {
  const https = require('https')
  const fs = require('fs')
  const path = require('path')

  // 验证 repoUrl 格式
  const GITHUB_REPO_URL_PATTERN = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/
  if (!GITHUB_REPO_URL_PATTERN.test(repoUrl)) {
    throw new Error('Invalid repository URL')
  }

  // 验证并规范化目标路径，防止路径遍历
  const normalizedPath = path.normalize(targetPath)
  const downloadsPath = app.getPath('downloads')
  const resolvedPath = path.resolve(downloadsPath, normalizedPath)

  if (!resolvedPath.startsWith(downloadsPath)) {
    throw new Error('Invalid target path: path traversal detected')
  }
  targetPath = resolvedPath

  // 确保目标目录存在
  const targetDir = path.dirname(targetPath)
  try {
    await fs.promises.mkdir(targetDir, { recursive: true })
  } catch (err) {
    // 目录已存在，忽略错误
  }

  const zipUrl = `${repoUrl}/archive/refs/heads/main.zip`

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(targetPath)
    https.get(zipUrl, (response) => {
      if (response.statusCode !== 200) {
        fs.unlink(targetPath, () => {})
        reject(new Error('Download failed'))
        return
      }
      response.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve({ success: true, path: targetPath })
      })
    }).on('error', (err) => {
      fs.unlink(targetPath, () => {})
      reject(new Error('Download failed'))
    })
  })
})

// 文件系统相关
ipcMain.handle('fs:selectFolder', async () => {
  const folderReader = new FolderReader()
  return await folderReader.selectFolder()
})

ipcMain.handle('fs:readFolderStructure', async (event, folderPath) => {
  const folderReader = new FolderReader()
  return await folderReader.readFolderStructure(folderPath)
})

// 本地存储相关
ipcMain.handle('storage:get', async (event, key) => {
  return await localStorage.get(key)
})

ipcMain.handle('storage:set', async (event, key, value) => {
  return await localStorage.set(key, value)
})

ipcMain.handle('storage:delete', async (event, key) => {
  return await localStorage.delete(key)
})

// 缓存相关
ipcMain.handle('cache:get', async (event, key) => {
  return await cacheManager.get(key)
})

ipcMain.handle('cache:set', async (event, key, data, ttl) => {
  await cacheManager.set(key, data, ttl)
  return { success: true }
})

ipcMain.handle('cache:delete', async (event, key) => {
  return await cacheManager.delete(key)
})

ipcMain.handle('cache:clear', async () => {
  await cacheManager.clear()
  return { success: true }
})

ipcMain.handle('cache:cleanup', async () => {
  return await cacheManager.cleanup()
})

ipcMain.handle('cache:stats', async () => {
  return cacheManager.getStats()
})

// 大文件上传相关
ipcMain.handle('upload:largeFile', async (event, params) => {
  if (!chunkUploader) {
    throw new Error('Not authenticated')
  }

  // 进度回调通过 event.sender.send 发送给渲染进程
  const onProgress = (progress) => {
    event.sender.send('upload:progress', progress)
  }

  return await chunkUploader.uploadLargeFile(params, onProgress)
})

ipcMain.handle('upload:multipleFiles', async (event, params) => {
  if (!chunkUploader) {
    throw new Error('Not authenticated')
  }

  const onProgress = (progress) => {
    event.sender.send('upload:progress', progress)
  }

  return await chunkUploader.uploadMultipleFiles(params, onProgress)
})

ipcMain.handle('upload:fromBuffer', async (event, params) => {
  if (!chunkUploader) {
    throw new Error('Not authenticated')
  }

  const onProgress = (progress) => {
    event.sender.send('upload:progress', progress)
  }

  return await chunkUploader.uploadFromBuffer(params, onProgress)
})

ipcMain.handle('upload:checkSize', async (event, filePath) => {
  const fs = require('fs').promises
  const stats = await fs.stat(filePath)
  return {
    size: stats.size,
    needChunkUpload: chunkUploader ? chunkUploader.needChunkUpload(stats.size) : false
  }
})

// ========== 上传管理 IPC 处理器 ==========

// 初始化上传管理器
async function initUploadManager() {
  if (!uploadManager) {
    uploadManager = new UploadManager({
      maxConcurrency: 3,
      largeFileThreshold: 50 * 1024 * 1024  // 50MB
    })

    // 设置事件回调
    uploadManager.on('progress', (progress) => {
      if (mainWindow) {
        mainWindow.webContents.send('upload:progress', progress)
      }
    })

    uploadManager.on('task:complete', (task) => {
      if (mainWindow) {
        mainWindow.webContents.send('upload:taskComplete', {
          taskId: task.id,
          status: 'completed',
          stats: task.stats
        })
      }
    })

    uploadManager.on('task:error', (task) => {
      if (mainWindow) {
        mainWindow.webContents.send('upload:taskError', {
          taskId: task.id,
          status: 'error',
          stats: task.stats,
          failedFiles: task.files.filter(f => f.status === 'failed').map(f => ({
            path: f.path,
            error: f.error
          }))
        })
      }
    })

    uploadManager.on('file:progress', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('upload:fileProgress', data)
      }
    })

    await uploadManager.init()
  }
  return uploadManager
}

// 创建上传任务
ipcMain.handle('upload:createTask', async (event, params) => {
  try {
    const manager = await initUploadManager()
    const task = await manager.createTask(params)
    return { success: true, task }
  } catch (error) {
    console.error('Create task error:', error)
    return { success: false, error: error.message }
  }
})

// 启动任务
ipcMain.handle('upload:startTask', async (event, taskId) => {
  try {
    const manager = await initUploadManager()
    await manager.startTask(taskId)
    return { success: true }
  } catch (error) {
    console.error('Start task error:', error)
    return { success: false, error: error.message }
  }
})

// 暂停任务
ipcMain.handle('upload:pauseTask', async (event, taskId) => {
  try {
    const manager = await initUploadManager()
    await manager.pauseTask(taskId)
    return { success: true }
  } catch (error) {
    console.error('Pause task error:', error)
    return { success: false, error: error.message }
  }
})

// 恢复任务
ipcMain.handle('upload:resumeTask', async (event, taskId) => {
  try {
    const manager = await initUploadManager()
    await manager.resumeTask(taskId)
    return { success: true }
  } catch (error) {
    console.error('Resume task error:', error)
    return { success: false, error: error.message }
  }
})

// 取消任务
ipcMain.handle('upload:cancelTask', async (event, taskId) => {
  try {
    const manager = await initUploadManager()
    await manager.cancelTask(taskId)
    return { success: true }
  } catch (error) {
    console.error('Cancel task error:', error)
    return { success: false, error: error.message }
  }
})

// 重试失败文件
ipcMain.handle('upload:retryFailed', async (event, taskId, filePaths) => {
  try {
    const manager = await initUploadManager()
    const result = await manager.retryFailed(taskId, filePaths)
    return { success: true, ...result }
  } catch (error) {
    console.error('Retry failed error:', error)
    return { success: false, error: error.message }
  }
})

// 获取进度
ipcMain.handle('upload:getProgress', async (event, taskId) => {
  try {
    const manager = await initUploadManager()
    const progress = manager.getProgress(taskId)
    return progress
  } catch (error) {
    console.error('Get progress error:', error)
    return null
  }
})

// 获取任务列表
ipcMain.handle('upload:getTasks', async () => {
  try {
    const manager = await initUploadManager()
    const tasks = manager.getTasks()
    return tasks
  } catch (error) {
    console.error('Get tasks error:', error)
    return []
  }
})

// 检测冲突
ipcMain.handle('upload:checkConflict', async (event, params) => {
  try {
    const manager = await initUploadManager()
    const result = await manager.checkConflict(params.taskId)
    return result
  } catch (error) {
    console.error('Check conflict error:', error)
    return { conflicts: [], newFiles: [], identicalFiles: [], error: error.message }
  }
})

// 设置并发数
ipcMain.handle('upload:setConcurrency', async (event, value) => {
  try {
    const manager = await initUploadManager()
    manager.setConcurrency(value)
    return { success: true }
  } catch (error) {
    console.error('Set concurrency error:', error)
    return { success: false, error: error.message }
  }
})
