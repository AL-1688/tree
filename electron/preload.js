const { contextBridge, ipcRenderer } = require('electron')

// 向渲染进程暴露安全的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // OAuth 认证
  auth: {
    login: (config) => ipcRenderer.invoke('auth:login', config),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getStoredToken: () => ipcRenderer.invoke('auth:getStoredToken')
  },

  // GitHub API
  api: {
    getCurrentUser: () => ipcRenderer.invoke('api:getCurrentUser'),
    getRepositories: (params) => ipcRenderer.invoke('api:getRepositories', params),
    getRepository: (owner, repo) => ipcRenderer.invoke('api:getRepository', owner, repo),
    createRepository: (params) => ipcRenderer.invoke('api:createRepository', params),
    updateRepository: (owner, repo, params) => ipcRenderer.invoke('api:updateRepository', owner, repo, params),
    deleteRepository: (owner, repo) => ipcRenderer.invoke('api:deleteRepository', owner, repo),
    getRepositoryContent: (params) => ipcRenderer.invoke('api:getRepositoryContent', params),
    getFileContent: (params) => ipcRenderer.invoke('api:getFileContent', params),
    uploadFile: (params) => ipcRenderer.invoke('api:uploadFile', params),
    deleteFile: (params) => ipcRenderer.invoke('api:deleteFile', params),
    updateFile: (params) => ipcRenderer.invoke('api:updateFile', params),
    searchRepositories: (params) => ipcRenderer.invoke('api:searchRepositories', params),
    forkRepository: (owner, repo) => ipcRenderer.invoke('api:forkRepository', owner, repo)
  },

  // 下载相关
  download: {
    gitClone: (cloneUrl, targetPath) => ipcRenderer.invoke('download:gitClone', cloneUrl, targetPath),
    downloadZip: (repoUrl, targetPath) => ipcRenderer.invoke('download:downloadZip', repoUrl, targetPath)
  },

  // 文件系统
  fs: {
    selectFolder: () => ipcRenderer.invoke('fs:selectFolder'),
    readFolderStructure: (folderPath) => ipcRenderer.invoke('fs:readFolderStructure', folderPath)
  },

  // 本地存储
  storage: {
    get: (key) => ipcRenderer.invoke('storage:get', key),
    set: (key, value) => ipcRenderer.invoke('storage:set', key, value),
    delete: (key) => ipcRenderer.invoke('storage:delete', key)
  },

  // 缓存管理
  cache: {
    get: (key) => ipcRenderer.invoke('cache:get', key),
    set: (key, data, ttl) => ipcRenderer.invoke('cache:set', key, data, ttl),
    delete: (key) => ipcRenderer.invoke('cache:delete', key),
    clear: () => ipcRenderer.invoke('cache:clear'),
    cleanup: () => ipcRenderer.invoke('cache:cleanup'),
    stats: () => ipcRenderer.invoke('cache:stats')
  },

  // 大文件上传
  upload: {
    largeFile: (params) => ipcRenderer.invoke('upload:largeFile', params),
    multipleFiles: (params) => ipcRenderer.invoke('upload:multipleFiles', params),
    fromBuffer: (params) => ipcRenderer.invoke('upload:fromBuffer', params),
    checkSize: (filePath) => ipcRenderer.invoke('upload:checkSize', filePath),
    onProgress: (callback) => {
      ipcRenderer.on('upload:progress', (event, progress) => callback(progress))
    },
    removeProgressListener: () => {
      ipcRenderer.removeAllListeners('upload:progress')
    }
  }
})
