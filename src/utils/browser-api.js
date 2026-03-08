/**
 * 浏览器环境 Mock API
 * 当应用在浏览器中运行时（非 Electron 环境），提供兼容的 API 实现
 */

// 检测是否在 Electron 环境中
const isElectron = typeof window !== 'undefined' && window.electronAPI

// 本地存储键名
const STORAGE_KEYS = {
  AUTH_TOKEN: 'github_client_auth_token',
  OAUTH_CONFIG: 'github_client_oauth_config',
  USER_DATA: 'github_client_user_data'
}

// 创建浏览器兼容的 API
const browserAPI = {
  // OAuth 认证
  auth: {
    login: async (config) => {
      console.log('[Browser Mock] auth.login called with:', config)
      // 在浏览器环境中模拟 OAuth 流程
      // 由于浏览器无法真正完成 OAuth，返回提示信息
      return {
        success: false,
        error: '浏览器预览模式暂不支持 OAuth 登录。请在 Electron 桌面应用中使用完整功能。'
      }
    },
    logout: async () => {
      console.log('[Browser Mock] auth.logout called')
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN)
      localStorage.removeItem(STORAGE_KEYS.USER_DATA)
      return { success: true }
    },
    getStoredToken: async () => {
      const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
      console.log('[Browser Mock] auth.getStoredToken:', token ? 'found' : 'not found')
      return token
    }
  },

  // GitHub API
  api: {
    getCurrentUser: async () => {
      const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA)
      if (userData) {
        return JSON.parse(userData)
      }
      // 返回模拟用户数据用于预览
      return {
        login: 'preview-user',
        name: '预览用户',
        avatar_url: 'https://api.github.com/users/octocat',
        bio: '浏览器预览模式'
      }
    },
    getRepositories: async (params) => {
      console.log('[Browser Mock] api.getRepositories:', params)
      // 返回模拟的仓库列表
      return [
        {
          id: 1,
          name: 'example-repo',
          full_name: 'preview-user/example-repo',
          description: '这是一个示例仓库（预览模式）',
          html_url: 'https://github.com/preview-user/example-repo',
          stargazers_count: 42,
          forks_count: 10,
          language: 'JavaScript',
          updated_at: new Date().toISOString()
        },
        {
          id: 2,
          name: 'another-repo',
          full_name: 'preview-user/another-repo',
          description: '另一个示例仓库',
          html_url: 'https://github.com/preview-user/another-repo',
          stargazers_count: 100,
          forks_count: 25,
          language: 'Vue',
          updated_at: new Date().toISOString()
        }
      ]
    },
    getRepository: async (owner, repo) => {
      console.log('[Browser Mock] api.getRepository:', owner, repo)
      return {
        id: 1,
        name: repo,
        full_name: `${owner}/${repo}`,
        description: '示例仓库详情（预览模式）',
        html_url: `https://github.com/${owner}/${repo}`,
        stargazers_count: 42,
        forks_count: 10,
        watchers_count: 20,
        language: 'JavaScript',
        default_branch: 'main',
        updated_at: new Date().toISOString()
      }
    },
    createRepository: async (params) => {
      console.log('[Browser Mock] api.createRepository:', params)
      return { success: true, name: params.name }
    },
    updateRepository: async (owner, repo, params) => {
      console.log('[Browser Mock] api.updateRepository:', owner, repo, params)
      return { success: true }
    },
    deleteRepository: async (owner, repo) => {
      console.log('[Browser Mock] api.deleteRepository:', owner, repo)
      return { success: true }
    },
    getRepositoryContent: async (params) => {
      console.log('[Browser Mock] api.getRepositoryContent:', params)
      return [
        { name: 'README.md', type: 'file', path: 'README.md' },
        { name: 'src', type: 'dir', path: 'src' },
        { name: 'package.json', type: 'file', path: 'package.json' }
      ]
    },
    getFileContent: async (params) => {
      console.log('[Browser Mock] api.getFileContent:', params)
      return { content: '# 示例文件\n\n这是预览模式下的示例内容。', sha: 'abc123' }
    },
    uploadFile: async (params) => {
      console.log('[Browser Mock] api.uploadFile:', params)
      return { success: true }
    },
    deleteFile: async (params) => {
      console.log('[Browser Mock] api.deleteFile:', params)
      return { success: true }
    },
    updateFile: async (params) => {
      console.log('[Browser Mock] api.updateFile:', params)
      return { success: true }
    },
    searchRepositories: async (params) => {
      console.log('[Browser Mock] api.searchRepositories:', params)
      return {
        total_count: 2,
        items: [
          {
            id: 1,
            name: 'search-result-1',
            full_name: 'user/search-result-1',
            description: '搜索结果示例',
            html_url: 'https://github.com/user/search-result-1',
            stargazers_count: 50
          }
        ]
      }
    },
    forkRepository: async (owner, repo) => {
      console.log('[Browser Mock] api.forkRepository:', owner, repo)
      return { success: true }
    }
  },

  // 下载相关
  download: {
    gitClone: async (cloneUrl, targetPath) => {
      console.log('[Browser Mock] download.gitClone:', cloneUrl, targetPath)
      return { success: true, path: targetPath }
    },
    downloadZip: async (repoUrl, targetPath) => {
      console.log('[Browser Mock] download.downloadZip:', repoUrl, targetPath)
      return { success: true, path: targetPath }
    }
  },

  // 文件系统
  fs: {
    selectFolder: async () => {
      console.log('[Browser Mock] fs.selectFolder')
      return null // 浏览器无法选择文件夹
    },
    readFolderStructure: async (folderPath) => {
      console.log('[Browser Mock] fs.readFolderStructure:', folderPath)
      return null
    }
  },

  // 本地存储
  storage: {
    get: async (key) => {
      const value = localStorage.getItem(`github_client_${key}`)
      console.log('[Browser Mock] storage.get:', key, value ? 'found' : 'not found')
      return value ? JSON.parse(value) : null
    },
    set: async (key, value) => {
      localStorage.setItem(`github_client_${key}`, JSON.stringify(value))
      console.log('[Browser Mock] storage.set:', key)
      return { success: true }
    },
    delete: async (key) => {
      localStorage.removeItem(`github_client_${key}`)
      console.log('[Browser Mock] storage.delete:', key)
      return { success: true }
    }
  },

  // 缓存管理
  cache: {
    get: async (key) => {
      const value = sessionStorage.getItem(`cache_${key}`)
      return value ? JSON.parse(value) : null
    },
    set: async (key, data, ttl) => {
      sessionStorage.setItem(`cache_${key}`, JSON.stringify({ data, expiry: Date.now() + (ttl || 3600000) }))
      return { success: true }
    },
    delete: async (key) => {
      sessionStorage.removeItem(`cache_${key}`)
      return { success: true }
    },
    clear: async () => {
      sessionStorage.clear()
      return { success: true }
    },
    cleanup: async () => {
      return { success: true }
    },
    stats: () => ({
      keys: 0,
      size: 0
    })
  },

  // 上传管理
  upload: {
    createTask: async (params) => {
      console.log('[Browser Mock] upload.createTask:', params)
      return { success: true, task: { id: 'mock-task-1', ...params } }
    },
    startTask: async (taskId) => {
      console.log('[Browser Mock] upload.startTask:', taskId)
      return { success: true }
    },
    pauseTask: async (taskId) => {
      console.log('[Browser Mock] upload.pauseTask:', taskId)
      return { success: true }
    },
    resumeTask: async (taskId) => {
      console.log('[Browser Mock] upload.resumeTask:', taskId)
      return { success: true }
    },
    cancelTask: async (taskId) => {
      console.log('[Browser Mock] upload.cancelTask:', taskId)
      return { success: true }
    },
    retryFailed: async (taskId, filePaths) => {
      console.log('[Browser Mock] upload.retryFailed:', taskId, filePaths)
      return { success: true }
    },
    getProgress: async (taskId) => {
      return { progress: 0, status: 'pending' }
    },
    getTasks: async () => {
      return []
    },
    checkConflict: async (params) => {
      return { conflicts: [], newFiles: [], identicalFiles: [] }
    },
    setConcurrency: async (value) => {
      console.log('[Browser Mock] upload.setConcurrency:', value)
      return { success: true }
    },
    largeFile: async (params) => {
      console.log('[Browser Mock] upload.largeFile:', params)
      return { success: true }
    },
    multipleFiles: async (params) => {
      console.log('[Browser Mock] upload.multipleFiles:', params)
      return { success: true }
    },
    fromBuffer: async (params) => {
      console.log('[Browser Mock] upload.fromBuffer:', params)
      return { success: true }
    },
    checkSize: async (filePath) => {
      return { size: 0, needChunkUpload: false }
    },
    onProgress: (callback) => {
      console.log('[Browser Mock] upload.onProgress registered')
    },
    onTaskComplete: (callback) => {
      console.log('[Browser Mock] upload.onTaskComplete registered')
    },
    onTaskError: (callback) => {
      console.log('[Browser Mock] upload.onTaskError registered')
    },
    removeProgressListener: () => {
      console.log('[Browser Mock] upload.removeProgressListener')
    }
  }
}

// 导出浏览器 API（仅在非 Electron 环境中使用）
export default browserAPI

// 自动注入到 window 对象（如果在浏览器环境）
if (typeof window !== 'undefined' && !window.electronAPI) {
  window.electronAPI = browserAPI
  console.log('[Browser Mock] electronAPI has been injected for browser compatibility')
}
