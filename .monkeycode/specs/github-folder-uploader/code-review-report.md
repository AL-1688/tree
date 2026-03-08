# 代码审查报告 - 上传模块

## 审查日期: 2026-03-08

## 发现的问题

### 1. upload-manager.js - 潜在的内存泄漏和性能问题

**问题 1: processQueue 中的无限循环风险**
- 文件: `electron/upload/upload-manager.js`
- 行号: 262-286
- 问题: `while (!this.queue.isEmpty())` 循环在极端情况下可能导致无限循环
- 建议: 添加最大迭代次数限制和超时检查

```javascript
// 当前代码
while (!this.queue.isEmpty()) {
  const item = this.queue.dequeue()
  // ...
}

// 建议修改
const MAX_ITERATIONS = 10000
let iterations = 0
while (!this.queue.isEmpty() && iterations < MAX_ITERATIONS) {
  iterations++
  const item = this.queue.dequeue()
  // ...
}
```

**问题 2: processFile 中的错误处理不完整**
- 文件: `electron/upload/upload-manager.js`
- 行号: 280-283
- 问题: `processFile` 的 catch 只打印日志，没有通知 UI
- 建议: 在 catch 中发送进度更新

```javascript
// 当前代码
this.processFile(task, item, slotId).catch(error => {
  console.error('Error processing file:', error)
})

// 建议修改
this.processFile(task, item, slotId).catch(error => {
  console.error('Error processing file:', error)
  this.emit('file:error', {
    taskId: task.id,
    filePath: item.path,
    error: error.message
  })
})
```

**问题 3: readFolderFiles 递归没有深度限制**
- 文件: `electron/upload/upload-manager.js`
- 行号: 150-174
- 问题: 深度嵌套的目录结构可能导致栈溢出
- 建议: 添加最大深度限制

```javascript
// 建议添加
const MAX_DEPTH = 50
const readDir = async (dirPath, relativePath = '', depth = 0) => {
  if (depth > MAX_DEPTH) {
    console.warn(`Max directory depth reached: ${dirPath}`)
    return
  }
  // ... rest of the code
}
```

### 2. concurrency-controller.js - 边界情况处理

**问题 4: acquireSlot 可能导致死锁**
- 文件: `electron/upload/concurrency-controller.js`
- 行号: 30-44
- 问题: 如果 maxConcurrency 被设置为 0，while 循环将永远等待
- 建议: 添加验证

```javascript
// 建议在 setMaxConcurrency 中添加
setMaxConcurrency(value) {
  this.maxConcurrency = Math.max(this.minConcurrency, Math.min(this.maxAllowedConcurrency, value))
  // 确保 maxConcurrency 至少为 1
  if (this.maxConcurrency < 1) {
    this.maxConcurrency = 1
  }
}
```

### 3. upload-state-store.js - 数据完整性

**问题 5: 快照保存失败没有处理**
- 文件: `electron/upload/upload-state-store.js`
- 行号: 77-115
- 问题: saveSnapshot 中的 fs 操作可能失败，但没有错误处理
- 建议: 添加 try-catch 和重试逻辑

```javascript
// 建议修改 saveSnapshot
async saveSnapshot(task) {
  try {
    await this.init()
    // ... existing code
  } catch (error) {
    console.error('Failed to save snapshot:', error)
    // 不抛出错误，避免中断上传流程
  }
}
```

### 4. conflict-detector.js - 性能问题

**问题 6: 大量文件时的性能问题**
- 文件: `electron/upload/conflict-detector.js`
- 行号: 19-61
- 问题: detect 方法对每个文件都调用 calculateLocalSHA，可能很慢
- 建议: 使用 Promise.all 并行计算

```javascript
// 当前代码
for (const file of files) {
  // ...
  const localSHA = await this.calculateLocalSHA(file.localPath)
  // ...
}

// 建议修改
const shaPromises = files.map(async file => {
  const remotePath = this.getRemotePath(file.path, targetPath)
  const remoteFile = remoteFiles.get(remotePath)

  if (!remoteFile) {
    return { file, type: 'new' }
  }

  const localSHA = await this.calculateLocalSHA(file.localPath)
  return { file, localSHA, remoteFile }
})

const results = await Promise.all(shaPromises)
// Process results...
```

### 5. upload-queue.js - 状态管理

**问题 7: dequeue 返回后文件状态变更**
- 文件: `electron/upload/upload-queue.js`
- 行号: 33-43
- 问题: dequeue 修改了文件状态为 'uploading'，但调用者可能期望原始状态
- 建议: 文档说明或分离状态管理

## 性能优化建议

### 1. 添加批量处理支持
在 ConflictDetector 中添加批量处理，限制并发 SHA 计算数量：
```javascript
async detectWithConcurrency(params, concurrency = 5) {
  // Process files in batches of `concurrency`
}
```

### 2. 添加上传速度计算缓存
在 UploadManager 中缓存速度计算结果，避免频繁重新计算：
```javascript
this.speedCache = {
  lastUpdate: 0,
  value: 0,
  ttl: 1000  // 1 second
}
```

### 3. 添加任务状态清理
定期清理已完成的任务，避免内存泄漏：
```javascript
// 在 UploadManager 中添加
startCleanupTimer() {
  this.cleanupTimer = setInterval(() => {
    for (const [id, task] of this.tasks) {
      if (task.status === 'completed' || task.status === 'cancelled') {
        if (Date.now() - new Date(task.updatedAt).getTime() > 3600000) {  // 1 hour
          this.tasks.delete(id)
        }
      }
    }
  }, 600000)  // 10 minutes
}
```

## 安全建议

### 1. 路径遍历防护
在 readFolderFiles 中添加路径验证：
```javascript
const fullPath = path.resolve(dirPath, entry.name)
if (!fullPath.startsWith(folderPath)) {
  console.warn(`Skipping suspicious path: ${fullPath}`)
  continue
}
```

### 2. 文件大小限制
在 createTask 中添加总大小限制：
```javascript
const MAX_TOTAL_SIZE = 2 * 1024 * 1024 * 1024  // 2GB
if (task.stats.totalSize > MAX_TOTAL_SIZE) {
  throw new Error(`Total size exceeds limit: ${formatSize(MAX_TOTAL_SIZE)}`)
}
```

## 总结

| 类别 | 问题数 | 优先级 |
|------|--------|--------|
| 潜在 Bug | 4 | 高 |
| 性能问题 | 3 | 中 |
| 安全问题 | 2 | 中 |
| 代码质量 | 3 | 低 |

**建议优先修复:**
1. acquireSlot 死锁风险 (问题 4)
2. processQueue 无限循环风险 (问题 1)
3. 路径遍历安全防护 (安全建议 1)
