const { dialog } = require('electron')
const fs = require('fs').promises
const path = require('path')

class FolderReader {
  async selectFolder() {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  }

  async readFolderStructure(folderPath) {
    const stats = await fs.stat(folderPath)

    if (!stats.isDirectory()) {
      throw new Error('Selected path is not a directory')
    }

    return await this.buildFileTree(folderPath, folderPath)
  }

  async buildFileTree(fullPath, rootPath) {
    const stats = await fs.stat(fullPath)
    const name = path.basename(fullPath)
    const relativePath = path.relative(rootPath, fullPath)

    const node = {
      name,
      path: relativePath,
      type: stats.isDirectory() ? 'folder' : 'file',
      size: stats.isFile() ? stats.size : undefined
    }

    if (stats.isDirectory()) {
      node.children = []
      const entries = await fs.readdir(fullPath)

      for (const entry of entries) {
        // 跳过隐藏文件和文件夹
        if (entry.startsWith('.')) {
          continue
        }

        const childPath = path.join(fullPath, entry)
        try {
          const childNode = await this.buildFileTree(childPath, rootPath)
          node.children.push(childNode)
        } catch (error) {
          // 忽略无法访问的文件
          console.warn(`Cannot access ${childPath}:`, error.message)
        }
      }

      // 计算文件夹总大小
      node.size = node.children.reduce((sum, child) => sum + (child.size || 0), 0)
    }

    return node
  }

  calculateFolderSize(fileTree) {
    let totalFiles = 0
    let totalFolders = 0
    let totalSize = 0

    function traverse(node) {
      if (node.type === 'file') {
        totalFiles++
        totalSize += node.size || 0
      } else {
        totalFolders++
        if (node.children) {
          node.children.forEach(traverse)
        }
      }
    }

    traverse(fileTree)

    return {
      totalFiles,
      totalFolders,
      totalSize
    }
  }
}

module.exports = FolderReader
