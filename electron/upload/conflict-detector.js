/**
 * 冲突检测器
 * 检测本地文件与远程仓库的冲突
 */

const fs = require('fs').promises
const crypto = require('crypto')

class ConflictDetector {
  constructor(githubAPI) {
    this.githubAPI = githubAPI
  }

  /**
   * 检测冲突
   * @param {Object} params 检测参数
   * @returns {Object} 冲突检测结果
   */
  async detect(params) {
    const { owner, repo, branch, files, targetPath } = params

    const conflicts = []
    const newFiles = []
    const identicalFiles = []

    // 批量获取远程文件信息
    const remoteFiles = await this.getRemoteFiles(owner, repo, branch, targetPath)

    for (const file of files) {
      const remotePath = this.getRemotePath(file.path, targetPath)
      const remoteFile = remoteFiles.get(remotePath)

      if (!remoteFile) {
        // 远程不存在，是新文件
        newFiles.push(file.path)
        continue
      }

      // 计算本地文件 SHA
      const localSHA = await this.calculateLocalSHA(file.localPath)

      if (localSHA === remoteFile.sha) {
        // SHA 相同，可以跳过
        identicalFiles.push(file.path)
      } else {
        // SHA 不同，存在冲突
        conflicts.push({
          path: file.path,
          localSHA,
          remoteSHA: remoteFile.sha,
          localSize: file.size,
          remoteSize: remoteFile.size
        })
      }
    }

    return {
      conflicts,
      newFiles,
      identicalFiles
    }
  }

  /**
   * 获取远程文件列表
   * @param {string} owner 仓库所有者
   * @param {string} repo 仓库名
   * @param {string} branch 分支名
   * @param {string} targetPath 目标路径
   * @returns {Map} 远程文件映射 (path -> {sha, size})
   */
  async getRemoteFiles(owner, repo, branch, targetPath) {
    const fileMap = new Map()

    try {
      // 获取目录内容
      const contents = await this.githubAPI.getRepositoryContent({
        owner,
        repo,
        path: targetPath || '',
        ref: branch
      })

      // 递归获取所有文件
      await this.collectFiles(owner, repo, branch, contents, fileMap, targetPath)
    } catch (error) {
      if (error.status !== 404) {
        console.error('Failed to get remote files:', error)
      }
      // 404 表示目录不存在，返回空 Map
    }

    return fileMap
  }

  /**
   * 递归收集文件信息
   * @param {string} owner 仓库所有者
   * @param {string} repo 仓库名
   * @param {string} branch 分支名
   * @param {Array} contents 目录内容
   * @param {Map} fileMap 文件映射
   * @param {string} basePath 基础路径
   */
  async collectFiles(owner, repo, branch, contents, fileMap, basePath) {
    if (!Array.isArray(contents)) {
      // 单个文件
      if (contents.type === 'file') {
        const relativePath = this.getRelativePath(contents.path, basePath)
        fileMap.set(relativePath, {
          sha: contents.sha,
          size: contents.size
        })
      }
      return
    }

    for (const item of contents) {
      if (item.type === 'file') {
        const relativePath = this.getRelativePath(item.path, basePath)
        fileMap.set(relativePath, {
          sha: item.sha,
          size: item.size
        })
      } else if (item.type === 'dir') {
        // 递归获取子目录
        try {
          const subContents = await this.githubAPI.getRepositoryContent({
            owner,
            repo,
            path: item.path,
            ref: branch
          })
          await this.collectFiles(owner, repo, branch, subContents, fileMap, basePath)
        } catch (error) {
          console.error(`Failed to get contents of ${item.path}:`, error)
        }
      }
    }
  }

  /**
   * 获取相对路径
   * @param {string} fullPath 完整路径
   * @param {string} basePath 基础路径
   * @returns {string} 相对路径
   */
  getRelativePath(fullPath, basePath) {
    if (!basePath) return fullPath
    const normalizedBase = basePath.replace(/\/$/, '')
    return fullPath.startsWith(normalizedBase + '/')
      ? fullPath.slice(normalizedBase.length + 1)
      : fullPath
  }

  /**
   * 获取远程路径
   * @param {string} localPath 本地相对路径
   * @param {string} targetPath 目标路径
   * @returns {string} 远程路径
   */
  getRemotePath(localPath, targetPath) {
    if (!targetPath) return localPath
    const normalizedTarget = targetPath.replace(/\/$/, '')
    return `${normalizedTarget}/${localPath}`
  }

  /**
   * 计算本地文件 SHA (GitHub 格式)
   * @param {string} filePath 本地文件路径
   * @returns {string} SHA 值
   */
  async calculateLocalSHA(filePath) {
    try {
      const content = await fs.readFile(filePath)
      // GitHub 使用 blob SHA: sha1("blob " + size + "\0" + content)
      const header = `blob ${content.length}\0`
      const blob = Buffer.concat([Buffer.from(header), content])
      const sha = crypto.createHash('sha1').update(blob).digest('hex')
      return sha
    } catch (error) {
      console.error('Failed to calculate local SHA:', error)
      return null
    }
  }

  /**
   * 获取远程文件 SHA
   * @param {string} owner 仓库所有者
   * @param {string} repo 仓库名
   * @param {string} path 文件路径
   * @param {string} branch 分支名
   * @returns {string|null} SHA 值
   */
  async getRemoteSHA(owner, repo, path, branch) {
    try {
      const content = await this.githubAPI.getRepositoryContent({
        owner,
        repo,
        path,
        ref: branch
      })

      if (content && content.type === 'file') {
        return content.sha
      }
      return null
    } catch (error) {
      if (error.status === 404) {
        return null
      }
      throw error
    }
  }

  /**
   * 批量检测冲突（优化版本，适用于大量文件）
   * @param {Object} params 检测参数
   * @param {number} batchSize 批次大小
   * @returns {Object} 冲突检测结果
   */
  async detectBatch(params, batchSize = 20) {
    const { files, ...rest } = params
    const results = {
      conflicts: [],
      newFiles: [],
      identicalFiles: []
    }

    // 分批处理
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      const batchResult = await this.detect({ ...rest, files: batch })

      results.conflicts.push(...batchResult.conflicts)
      results.newFiles.push(...batchResult.newFiles)
      results.identicalFiles.push(...batchResult.identicalFiles)
    }

    return results
  }

  /**
   * 快速检查是否有冲突（不返回详细信息）
   * @param {Object} params 检测参数
   * @returns {boolean} 是否存在冲突
   */
  async hasConflicts(params) {
    const { owner, repo, branch, files, targetPath } = params

    const remoteFiles = await this.getRemoteFiles(owner, repo, branch, targetPath)

    for (const file of files) {
      const remotePath = this.getRemotePath(file.path, targetPath)
      const remoteFile = remoteFiles.get(remotePath)

      if (remoteFile) {
        // 文件存在，检查 SHA
        const localSHA = await this.calculateLocalSHA(file.localPath)
        if (localSHA !== remoteFile.sha) {
          return true  // 存在冲突
        }
      }
    }

    return false  // 无冲突
  }
}

module.exports = ConflictDetector
