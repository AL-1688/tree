const fs = require('fs').promises
const path = require('path')
const axios = require('axios')

/**
 * 大文件上传管理器
 * 使用 GitHub Git Data API 进行大文件的分块上传
 */
class ChunkUploader {
  constructor(accessToken, options = {}) {
    this.accessToken = accessToken
    this.baseUrl = 'https://api.github.com'
    this.chunkSize = options.chunkSize || 256 * 1024 // 默认 256KB
    this.threshold = options.threshold || 5 * 1024 * 1024 // 默认 5MB 以上为大文件
    this.maxRetries = options.maxRetries || 3
    this.retryDelay = options.retryDelay || 1000

    // 复用 axios 客户端实例
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `token ${this.accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    })
  }

  /**
   * 判断是否需要分块上传
   */
  needChunkUpload(fileSize) {
    return fileSize > this.threshold
  }

  /**
   * 创建 Git Blob
   */
  async createBlob(owner, repo, content, encoding = 'base64') {
    const response = await this.client.post(`/repos/${owner}/${repo}/git/blobs`, {
      content,
      encoding
    })

    return response.data
  }

  /**
   * 获取当前分支的最新 commit
   */
  async getRef(owner, repo, branch = 'main') {
    const response = await this.client.get(`/repos/${owner}/${repo}/git/ref/heads/${branch}`)
    return response.data
  }

  /**
   * 创建 Tree
   */
  async createTree(owner, repo, baseTree, tree) {
    const response = await this.client.post(`/repos/${owner}/${repo}/git/trees`, {
      base_tree: baseTree,
      tree
    })

    return response.data
  }

  /**
   * 创建 Commit
   */
  async createCommit(owner, repo, message, tree, parents) {
    const response = await this.client.post(`/repos/${owner}/${repo}/git/commits`, {
      message,
      tree,
      parents
    })

    return response.data
  }

  /**
   * 更新 Reference
   */
  async updateRef(owner, repo, branch, sha) {
    const response = await this.client.patch(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      sha
    })

    return response.data
  }

  /**
   * 带重试的请求
   */
  async retryRequest(fn, retries = this.maxRetries) {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn()
      } catch (error) {
        if (i === retries - 1) throw error
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (i + 1)))
      }
    }
  }

  /**
   * 分块上传大文件
   * @param {Object} params 上传参数
   * @param {Function} onProgress 进度回调
   */
  async uploadLargeFile(params, onProgress) {
    const { owner, repo, filePath, targetPath, message, branch = 'main' } = params

    // 读取文件
    const fileBuffer = await fs.readFile(filePath)
    const fileSize = fileBuffer.length
    const base64Content = fileBuffer.toString('base64')

    if (onProgress) {
      onProgress({
        phase: 'creating-blob',
        progress: 0,
        total: fileSize
      })
    }

    // 创建 Blob
    const blob = await this.retryRequest(() =>
      this.createBlob(owner, repo, base64Content)
    )

    if (onProgress) {
      onProgress({
        phase: 'blob-created',
        progress: fileSize * 0.5,
        total: fileSize,
        blobSha: blob.sha
      })
    }

    // 获取当前分支引用
    const ref = await this.getRef(owner, repo, branch)
    const baseTreeSha = ref.object.sha

    if (onProgress) {
      onProgress({
        phase: 'creating-tree',
        progress: fileSize * 0.7,
        total: fileSize
      })
    }

    // 创建 Tree
    const tree = await this.createTree(owner, repo, baseTreeSha, [
      {
        path: targetPath,
        mode: '100644',
        type: 'blob',
        sha: blob.sha
      }
    ])

    if (onProgress) {
      onProgress({
        phase: 'creating-commit',
        progress: fileSize * 0.8,
        total: fileSize
      })
    }

    // 创建 Commit
    const commit = await this.createCommit(owner, repo, message, tree.sha, [ref.object.sha])

    if (onProgress) {
      onProgress({
        phase: 'updating-ref',
        progress: fileSize * 0.9,
        total: fileSize
      })
    }

    // 更新分支引用
    await this.updateRef(owner, repo, branch, commit.sha)

    if (onProgress) {
      onProgress({
        phase: 'completed',
        progress: fileSize,
        total: fileSize,
        commitSha: commit.sha
      })
    }

    return {
      success: true,
      path: targetPath,
      sha: blob.sha,
      commitSha: commit.sha,
      size: fileSize
    }
  }

  /**
   * 上传多个大文件
   */
  async uploadMultipleFiles(params, onProgress) {
    const { owner, repo, files, message, branch = 'main' } = params
    const results = []
    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0)
    let uploadedSize = 0

    // 读取所有文件并创建 blobs
    const treeItems = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      if (onProgress) {
        onProgress({
          phase: 'uploading',
          current: i + 1,
          total: files.length,
          file: file.targetPath,
          progress: uploadedSize,
          totalSize
        })
      }

      try {
        const fileBuffer = await fs.readFile(file.path)
        const base64Content = fileBuffer.toString('base64')

        const blob = await this.retryRequest(() =>
          this.createBlob(owner, repo, base64Content)
        )

        treeItems.push({
          path: file.targetPath,
          mode: '100644',
          type: 'blob',
          sha: blob.sha
        })

        uploadedSize += fileBuffer.length
        results.push({
          success: true,
          path: file.targetPath,
          sha: blob.sha
        })
      } catch (error) {
        results.push({
          success: false,
          path: file.targetPath,
          error: error.message
        })
      }
    }

    if (treeItems.length === 0) {
      return results
    }

    // 获取当前分支引用
    const ref = await this.getRef(owner, repo, branch)

    if (onProgress) {
      onProgress({
        phase: 'creating-tree',
        progress: uploadedSize * 0.9,
        totalSize
      })
    }

    // 创建 Tree
    const tree = await this.createTree(owner, repo, ref.object.sha, treeItems)

    // 创建 Commit
    const commit = await this.createCommit(owner, repo, message, tree.sha, [ref.object.sha])

    // 更新分支引用
    await this.updateRef(owner, repo, branch, commit.sha)

    if (onProgress) {
      onProgress({
        phase: 'completed',
        progress: uploadedSize,
        totalSize,
        commitSha: commit.sha
      })
    }

    return {
      results,
      commitSha: commit.sha
    }
  }

  /**
   * 从 Buffer 上传
   */
  async uploadFromBuffer(params, onProgress) {
    const { owner, repo, content, targetPath, message, branch = 'main' } = params

    const base64Content = Buffer.isBuffer(content)
      ? content.toString('base64')
      : Buffer.from(content).toString('base64')

    const fileSize = Buffer.byteLength(base64Content, 'base64')

    if (onProgress) {
      onProgress({
        phase: 'creating-blob',
        progress: 0,
        total: fileSize
      })
    }

    // 创建 Blob
    const blob = await this.retryRequest(() =>
      this.createBlob(owner, repo, base64Content)
    )

    // 获取当前分支引用
    const ref = await this.getRef(owner, repo, branch)

    // 创建 Tree
    const tree = await this.createTree(owner, repo, ref.object.sha, [
      {
        path: targetPath,
        mode: '100644',
        type: 'blob',
        sha: blob.sha
      }
    ])

    // 创建 Commit
    const commit = await this.createCommit(owner, repo, message, tree.sha, [ref.object.sha])

    // 更新分支引用
    await this.updateRef(owner, repo, branch, commit.sha)

    return {
      success: true,
      path: targetPath,
      sha: blob.sha,
      commitSha: commit.sha
    }
  }
}

module.exports = ChunkUploader
