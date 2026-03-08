/**
 * 大文件处理器
 * 判断文件大小并选择上传策略
 */

const path = require('path')

class LargeFileHandler {
  constructor(options = {}) {
    this.threshold = options.threshold || 50 * 1024 * 1024  // 50MB
    this.chunkUploader = options.chunkUploader
    this.gitHubAPI = options.gitHubAPI
  }

  /**
   * 检查文件处理策略
   * @param {number} fileSize 文件大小（字节）
   * @returns {Object} 处理策略
   */
  checkStrategy(fileSize) {
    if (fileSize > this.threshold) {
      return {
        type: 'lfs-recommended',
        threshold: this.threshold,
        fileSize
      }
    }

    // 小于阈值，使用分块上传
    return {
      type: 'chunk',
      threshold: this.threshold,
      fileSize
    }
  }

  /**
   * 执行上传（自动选择策略）
   * @param {Object} params 上传参数
   * @param {Function} onProgress 进度回调
   * @returns {Object} 上传结果
   */
  async upload(params, onProgress) {
    const strategy = this.checkStrategy(params.fileSize || 0)

    if (strategy.type === 'lfs-recommended') {
      // 返回需要用户确认的提示
      return {
        needConfirm: true,
        type: 'lfs-recommended',
        message: `文件大小 ${(params.fileSize / 1024 / 1024).toFixed(2)}MB 超过阈值 ${(this.threshold / 1024 / 1024).toFixed(2)}MB`,
        suggestion: '建议使用 Git LFS 管理大文件',
        options: [
          { label: '了解 Git LFS', action: 'learn-lfs', url: 'https://git-lfs.github.com/' },
          { label: '继续直接上传', action: 'continue-upload' }
        ]
      }
    }

    // 使用分块上传
    if (!this.chunkUploader) {
      throw new Error('ChunkUploader not configured')
    }

    return await this.uploadWithChunk(params, onProgress)
  }

  /**
   * 强制上传（忽略 LFS 建议）
   * @param {Object} params 上传参数
   * @param {Function} onProgress 进度回调
   * @returns {Object} 上传结果
   */
  async forceUpload(params, onProgress) {
    if (!this.chunkUploader) {
      throw new Error('ChunkUploader not configured')
    }

    return await this.uploadWithChunk(params, onProgress)
  }

  /**
   * 使用分块上传
   * @param {Object} params 上传参数
   * @param {Function} onProgress 进度回调
   * @returns {Object} 上传结果
   */
  async uploadWithChunk(params, onProgress) {
    const { owner, repo, branch, localPath, targetPath, message } = params

    return await this.chunkUploader.uploadLargeFile({
      owner,
      repo,
      filePath: localPath,
      targetPath,
      message,
      branch
    }, onProgress)
  }

  /**
   * 设置大文件阈值
   * @param {number} threshold 阈值（字节）
   */
  setThreshold(threshold) {
    this.threshold = threshold
  }

  /**
   * 获取当前阈值
   * @returns {number} 阈值（字节）
   */
  getThreshold() {
    return this.threshold
  }

  /**
   * 格式化文件大小
   * @param {number} bytes 字节数
   * @returns {string} 格式化后的字符串
   */
  static formatSize(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * 检查文件列表中是否有大文件
   * @param {Array} files 文件列表
   * @returns {Object} 检查结果
   */
  checkFileList(files) {
    const largeFiles = []
    let totalSize = 0

    for (const file of files) {
      totalSize += file.size || 0
      if (file.size > this.threshold) {
        largeFiles.push({
          path: file.path,
          size: file.size,
          formattedSize: LargeFileHandler.formatSize(file.size)
        })
      }
    }

    return {
      hasLargeFiles: largeFiles.length > 0,
      largeFiles,
      totalSize,
      formattedTotalSize: LargeFileHandler.formatSize(totalSize)
    }
  }

  /**
   * 生成上传建议
   * @param {Object} checkResult checkFileList 的结果
   * @returns {Object} 上传建议
   */
  generateRecommendation(checkResult) {
    if (!checkResult.hasLargeFiles) {
      return {
        type: 'normal',
        message: '所有文件可以正常上传'
      }
    }

    const lfsFiles = checkResult.largeFiles
      .map(f => `- ${f.path} (${f.formattedSize})`)
      .join('\n')

    return {
      type: 'lfs-recommended',
      message: `发现 ${checkResult.largeFiles.length} 个大文件（超过 ${LargeFileHandler.formatSize(this.threshold)}）：\n${lfsFiles}`,
      suggestion: '建议使用 Git LFS 管理大文件，以获得更好的性能和可靠性',
      learnMoreUrl: 'https://git-lfs.github.com/'
    }
  }
}

module.exports = LargeFileHandler
