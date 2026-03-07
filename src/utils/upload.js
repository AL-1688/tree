/**
 * 大文件上传工具
 * 自动判断文件大小，选择合适的上传方式
 */

// 默认大文件阈值（字节）
const DEFAULT_THRESHOLD = 5 * 1024 * 1024 // 5MB

/**
 * 检查文件是否需要分块上传
 */
export async function checkFileSize(filePath) {
  try {
    const result = await window.electronAPI.upload.checkSize(filePath)
    return result
  } catch (error) {
    console.warn('Failed to check file size:', error)
    return { size: 0, needChunkUpload: false }
  }
}

/**
 * 上传单个文件（自动选择上传方式）
 * @param {Object} params 上传参数
 * @param {Function} onProgress 进度回调
 */
export async function uploadFile(params, onProgress) {
  const { owner, repo, path, content, message, branch = 'main', sha } = params

  // 如果是 Buffer 或字符串内容
  if (content !== undefined) {
    const size = Buffer.byteLength(content)
    const threshold = await getThreshold()

    if (size > threshold) {
      // 大文件使用分块上传
      return await uploadLargeFileFromBuffer(
        { owner, repo, content, targetPath: path, message, branch },
        onProgress
      )
    } else {
      // 小文件使用普通上传
      return await window.electronAPI.api.uploadFile(params)
    }
  }

  // 如果是文件路径
  if (params.filePath) {
    return await uploadLargeFile(
      {
        owner,
        repo,
        filePath: params.filePath,
        targetPath: path,
        message,
        branch
      },
      onProgress
    )
  }

  throw new Error('Either content or filePath must be provided')
}

/**
 * 上传大文件（从文件路径）
 */
export async function uploadLargeFile(params, onProgress) {
  try {
    // 设置进度监听
    if (onProgress) {
      window.electronAPI.upload.onProgress(onProgress)
    }

    const result = await window.electronAPI.upload.largeFile(params)
    return result
  } catch (error) {
    console.error('Large file upload failed:', error)
    return {
      success: false,
      error: error.message
    }
  } finally {
    if (onProgress) {
      window.electronAPI.upload.removeProgressListener()
    }
  }
}

/**
 * 上传大文件（从 Buffer）
 */
export async function uploadLargeFileFromBuffer(params, onProgress) {
  try {
    if (onProgress) {
      window.electronAPI.upload.onProgress(onProgress)
    }

    const result = await window.electronAPI.upload.fromBuffer(params)
    return result
  } catch (error) {
    console.error('Large file upload failed:', error)
    return {
      success: false,
      error: error.message
    }
  } finally {
    if (onProgress) {
      window.electronAPI.upload.removeProgressListener()
    }
  }
}

/**
 * 批量上传多个文件
 * @param {Object} params 上传参数
 * @param {Array} files 文件列表 [{ path, targetPath, size }]
 * @param {Function} onProgress 进度回调
 */
export async function uploadMultipleFiles(params, onProgress) {
  try {
    if (onProgress) {
      window.electronAPI.upload.onProgress(onProgress)
    }

    const result = await window.electronAPI.upload.multipleFiles(params)
    return result
  } catch (error) {
    console.error('Multiple files upload failed:', error)
    return {
      results: [],
      error: error.message
    }
  } finally {
    if (onProgress) {
      window.electronAPI.upload.removeProgressListener()
    }
  }
}

/**
 * 获取大文件阈值配置
 */
async function getThreshold() {
  try {
    const settings = await window.electronAPI.storage.get('upload_settings')
    if (settings && settings.chunkThreshold) {
      return settings.chunkThreshold * 1024 * 1024 // MB 转字节
    }
  } catch (error) {
    // 忽略错误，使用默认值
  }
  return DEFAULT_THRESHOLD
}

/**
 * 格式化上传进度
 */
export function formatProgress(progress) {
  const { phase, current, total, file, progress: uploaded, totalSize } = progress

  const phaseLabels = {
    'creating-blob': '正在创建数据块...',
    'blob-created': '数据块创建完成',
    'creating-tree': '正在创建目录树...',
    'creating-commit': '正在提交更改...',
    'updating-ref': '正在更新分支...',
    'uploading': '正在上传文件...',
    'completed': '上传完成'
  }

  if (phase === 'uploading' && current && total) {
    return `${phaseLabels[phase] || phase} (${current}/${total}) ${file || ''}`
  }

  if (uploaded !== undefined && totalSize !== undefined) {
    const percent = totalSize > 0 ? Math.round((uploaded / totalSize) * 100) : 0
    return `${phaseLabels[phase] || phase} (${percent}%)`
  }

  return phaseLabels[phase] || phase
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
