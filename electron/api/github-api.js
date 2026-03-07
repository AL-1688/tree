const axios = require('axios')

class GitHubAPI {
  constructor(accessToken) {
    this.accessToken = accessToken
    this.baseUrl = 'https://api.github.com'
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    })

    // 响应拦截器
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response) {
          const { status, data } = error.response
          const message = data.message || 'GitHub API Error'
          throw new Error(`GitHub API Error (${status}): ${message}`)
        }
        throw error
      }
    )
  }

  // ========== 用户相关 ==========

  async getCurrentUser() {
    const response = await this.client.get('/user')
    return response.data
  }

  // ========== 仓库管理 ==========

  async getRepositories(params = {}) {
    const {
      type = 'all',
      sort = 'updated',
      direction = 'desc',
      per_page = 30,
      page = 1
    } = params

    const response = await this.client.get('/user/repos', {
      params: { type, sort, direction, per_page, page }
    })
    return response.data
  }

  async getRepository(owner, repo) {
    const response = await this.client.get(`/repos/${owner}/${repo}`)
    return response.data
  }

  async createRepository(params) {
    const response = await this.client.post('/user/repos', params)
    return response.data
  }

  async updateRepository(owner, repo, params) {
    const response = await this.client.patch(`/repos/${owner}/${repo}`, params)
    return response.data
  }

  async deleteRepository(owner, repo) {
    await this.client.delete(`/repos/${owner}/${repo}`)
  }

  // ========== 文件操作 ==========

  async getRepositoryContent(params) {
    const { owner, repo, path = '', ref } = params
    const url = `/repos/${owner}/${repo}/contents/${path}`
    const response = await this.client.get(url, {
      params: ref ? { ref } : {}
    })
    return response.data
  }

  async getFileContent(params) {
    const { owner, repo, path, ref } = params
    const url = `/repos/${owner}/${repo}/contents/${path}`
    const response = await this.client.get(url, {
      params: ref ? { ref } : {}
    })

    // 解码 Base64 内容
    if (response.data.content) {
      return Buffer.from(response.data.content, 'base64').toString('utf-8')
    }
    return ''
  }

  async uploadFile(params) {
    const { owner, repo, path, content, message, branch = 'main', sha } = params

    // 将内容编码为 Base64
    const contentBase64 = Buffer.isBuffer(content)
      ? content.toString('base64')
      : Buffer.from(content).toString('base64')

    const body = {
      message,
      content: contentBase64,
      branch
    }

    // 如果提供了 sha,则为更新文件
    if (sha) {
      body.sha = sha
    }

    try {
      const response = await this.client.put(
        `/repos/${owner}/${repo}/contents/${path}`,
        body
      )
      return {
        success: true,
        path,
        sha: response.data.content.sha
      }
    } catch (error) {
      return {
        success: false,
        path,
        error: error.message
      }
    }
  }

  async deleteFile(params) {
    const { owner, repo, path, message, sha, branch = 'main' } = params

    await this.client.delete(`/repos/${owner}/${repo}/contents/${path}`, {
      data: {
        message,
        sha,
        branch
      }
    })
  }

  async updateFile(params) {
    const { owner, repo, path, content, message, sha, branch = 'main' } = params

    const contentBase64 = Buffer.from(content).toString('base64')

    const response = await this.client.put(
      `/repos/${owner}/${repo}/contents/${path}`,
      {
        message,
        content: contentBase64,
        sha,
        branch
      }
    )

    return response.data
  }

  // ========== 搜索功能 ==========

  async searchRepositories(params = {}) {
    const { q, sort = 'best-match', order = 'desc', per_page = 30, page = 1 } = params

    const response = await this.client.get('/search/repositories', {
      params: { q, sort, order, per_page, page }
    })
    return response.data
  }

  async searchCode(params = {}) {
    const { q, sort = 'best-match', order = 'desc', per_page = 30, page = 1 } = params

    const response = await this.client.get('/search/code', {
      params: { q, sort, order, per_page, page }
    })
    return response.data
  }

  // 批量上传文件
  async uploadFiles(files, onProgress) {
    const results = []
    for (let i = 0; i < files.length; i++) {
      const result = await this.uploadFile(files[i])
      results.push(result)

      if (onProgress) {
        onProgress(i + 1, files.length, result)
      }
    }
    return results
  }

  // Fork 仓库
  async forkRepository(owner, repo) {
    const response = await this.client.post(`/repos/${owner}/${repo}/forks`)
    return response.data
  }
}

module.exports = GitHubAPI
