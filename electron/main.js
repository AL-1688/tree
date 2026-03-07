const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const GitHubOAuth = require('./auth/github-oauth')
const GitHubAPI = require('./api/github-api')
const FolderReader = require('./fs/folder-reader')
const LocalStorage = require('./storage/local-storage')

let mainWindow
let oAuth
let gitHubAPI
let localStorage

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

// OAuth 认证相关
ipcMain.handle('auth:login', async (event, config) => {
  try {
    if (config) {
      oAuth.setConfig(config.clientId, config.clientSecret)
    }
    const result = await oAuth.authenticate()
    if (result.success) {
      gitHubAPI = new GitHubAPI(result.accessToken)
    }
    return result
  } catch (error) {
    console.error('OAuth login error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('auth:logout', async () => {
  try {
    await oAuth.logout()
    gitHubAPI = null
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('auth:getStoredToken', async () => {
  try {
    const token = await oAuth.getStoredToken()
    if (token) {
      gitHubAPI = new GitHubAPI(token)
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
  const { exec } = require('child_process')
  const path = require('path')

  return new Promise((resolve, reject) => {
    exec(`git clone ${cloneUrl} "${targetPath}"`, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Git clone failed: ${error.message}`))
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

  const zipUrl = `${repoUrl}/archive/refs/heads/main.zip`

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(targetPath)
    https.get(zipUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Download failed with status ${response.statusCode}`))
        return
      }
      response.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve({ success: true, path: targetPath })
      })
    }).on('error', (err) => {
      fs.unlink(targetPath)
      reject(err)
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
