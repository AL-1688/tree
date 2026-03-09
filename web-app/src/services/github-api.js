import axios from 'axios'

const GITHUB_API_BASE = 'https://api.github.com'

class GitHubApiService {
  constructor() {
    this.token = null
    this.axios = axios.create({
      baseURL: GITHUB_API_BASE,
      timeout: 30000
    })

    // 响应拦截器处理错误
    this.axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response) {
          const { status, data } = error.response
          const message = data?.message || `Request failed with status ${status}`

          if (status === 401) {
            throw new Error('认证失败，请检查 Token 是否有效')
          } else if (status === 403) {
            throw new Error('访问被拒绝，可能超出 API 限制')
          } else if (status === 404) {
            throw new Error('资源不存在')
          }
          throw new Error(message)
        }
        throw error
      }
    )
  }

  setToken(token) {
    this.token = token
    if (token) {
      this.axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } else {
      delete this.axios.defaults.headers.common['Authorization']
    }
  }

  // 获取当前用户信息
  async getCurrentUser() {
    const response = await this.axios.get('/user')
    return response.data
  }

  // 获取用户仓库列表
  async getRepositories(params = {}) {
    const response = await this.axios.get('/user/repos', {
      params: {
        sort: 'updated',
        per_page: 100,
        ...params
      }
    })
    return response.data
  }

  // 获取单个仓库信息
  async getRepository(owner, repo) {
    const response = await this.axios.get(`/repos/${owner}/${repo}`)
    return response.data
  }

  // 创建仓库
  async createRepository(params) {
    const response = await this.axios.post('/user/repos', params)
    return response.data
  }

  // 更新仓库
  async updateRepository(owner, repo, params) {
    const response = await this.axios.patch(`/repos/${owner}/${repo}`, params)
    return response.data
  }

  // 删除仓库
  async deleteRepository(owner, repo) {
    await this.axios.delete(`/repos/${owner}/${repo}`)
    return { success: true }
  }

  // 获取仓库内容
  async getRepositoryContent(owner, repo, path = '', ref = 'main') {
    const response = await this.axios.get(`/repos/${owner}/${repo}/contents/${path}`, {
      params: { ref }
    })
    return response.data
  }

  // 获取文件内容
  async getFileContent(owner, repo, path, ref = 'main') {
    const response = await this.axios.get(`/repos/${owner}/${repo}/contents/${path}`, {
      params: { ref }
    })
    return response.data
  }

  // 上传文件
  async uploadFile(owner, repo, path, content, message, branch = 'main') {
    // 先检查文件是否存在
    let sha = null
    try {
      const existingFile = await this.getFileContent(owner, repo, path, branch)
      sha = existingFile.sha
    } catch (e) {
      // 文件不存在，忽略错误
    }

    const data = {
      message,
      content: typeof content === 'string'
        ? btoa(unescape(encodeURIComponent(content)))
        : content,
      branch
    }

    if (sha) {
      data.sha = sha
    }

    const response = await this.axios.put(`/repos/${owner}/${repo}/contents/${path}`, data)
    return response.data
  }

  // 删除文件
  async deleteFile(owner, repo, path, message, branch = 'main') {
    const existingFile = await this.getFileContent(owner, repo, path, branch)

    const response = await this.axios.delete(`/repos/${owner}/${repo}/contents/${path}`, {
      data: {
        message,
        sha: existingFile.sha,
        branch
      }
    })
    return response.data
  }

  // 搜索仓库
  async searchRepositories(query, params = {}) {
    const response = await this.axios.get('/search/repositories', {
      params: {
        q: query,
        per_page: 30,
        ...params
      }
    })
    return response.data
  }

  // Fork 仓库
  async forkRepository(owner, repo) {
    const response = await this.axios.post(`/repos/${owner}/${repo}/forks`)
    return response.data
  }

  // 获取仓库分支列表
  async getBranches(owner, repo) {
    const response = await this.axios.get(`/repos/${owner}/${repo}/branches`)
    return response.data
  }

  // 获取分支内容（树结构）
  async getTree(owner, repo, branch = 'main') {
    // 先获取分支信息获取 commit sha
    const branchInfo = await this.axios.get(`/repos/${owner}/${repo}/branches/${branch}`)
    const commitSha = branchInfo.data.commit.sha

    // 获取完整树
    const response = await this.axios.get(`/repos/${owner}/${repo}/git/trees/${commitSha}`, {
      params: { recursive: 1 }
    })
    return response.data
  }
}

export const githubApi = new GitHubApiService()
export default githubApi
