import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * 上传状态管理 Store
 */

// 文件上传状态枚举
export const FileStatus = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped'
}

// 任务状态枚举
export const TaskStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  ERROR: 'error'
}

export const useUploadStore = defineStore('upload', () => {
  // ========== 状态 ==========

  // 当前活跃的上传任务
  const currentTasks = ref([])

  // 等待中的任务队列
  const pendingTasks = ref([])

  // 已完成的任务（当前会话）
  const completedTasks = ref([])

  // 任务进度信息
  const taskProgress = ref(new Map())

  // 并发设置
  const concurrency = ref(3)
  const autoAdjustConcurrency = ref(true)

  // UI 状态
  const panelMinimized = ref(false)
  const panelVisible = ref(false)

  // ========== 计算属性 ==========

  // 正在运行的任务数量
  const runningTaskCount = computed(() => {
    return currentTasks.value.filter(t => t.status === TaskStatus.RUNNING).length
  })

  // 是否有任务正在进行
  const hasActiveTask = computed(() => {
    return currentTasks.value.length > 0
  })

  // 总体进度
  const totalProgress = computed(() => {
    if (currentTasks.value.length === 0) return null

    let totalFiles = 0
    let completedFiles = 0
    let totalSize = 0
    let completedSize = 0

    currentTasks.value.forEach(task => {
      totalFiles += task.stats?.totalFiles || 0
      completedFiles += task.stats?.completedFiles || 0
      totalSize += task.stats?.totalSize || 0
      completedSize += task.stats?.completedSize || 0
    })

    return {
      totalFiles,
      completedFiles,
      totalSize,
      completedSize,
      percent: totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0
    }
  })

  // ========== Actions ==========

  /**
   * 创建上传任务
   */
  async function createTask(params) {
    try {
      const task = await window.electronAPI.upload.createTask(params)
      pendingTasks.value.push(task)
      return task
    } catch (error) {
      console.error('Failed to create task:', error)
      throw error
    }
  }

  /**
   * 启动任务
   */
  async function startTask(taskId) {
    try {
      await window.electronAPI.upload.startTask(taskId)

      // 从等待队列移到活跃队列
      const taskIndex = pendingTasks.value.findIndex(t => t.id === taskId)
      if (taskIndex > -1) {
        const task = pendingTasks.value.splice(taskIndex, 1)[0]
        task.status = TaskStatus.RUNNING
        currentTasks.value.push(task)
      }

      showPanel()
    } catch (error) {
      console.error('Failed to start task:', error)
      throw error
    }
  }

  /**
   * 暂停任务
   */
  async function pauseTask(taskId) {
    try {
      await window.electronAPI.upload.pauseTask(taskId)

      const task = currentTasks.value.find(t => t.id === taskId)
      if (task) {
        task.status = TaskStatus.PAUSED
      }
    } catch (error) {
      console.error('Failed to pause task:', error)
      throw error
    }
  }

  /**
   * 恢复任务
   */
  async function resumeTask(taskId) {
    try {
      await window.electronAPI.upload.resumeTask(taskId)

      const task = currentTasks.value.find(t => t.id === taskId)
      if (task) {
        task.status = TaskStatus.RUNNING
      }
    } catch (error) {
      console.error('Failed to resume task:', error)
      throw error
    }
  }

  /**
   * 取消任务
   */
  async function cancelTask(taskId) {
    try {
      await window.electronAPI.upload.cancelTask(taskId)

      const taskIndex = currentTasks.value.findIndex(t => t.id === taskId)
      if (taskIndex > -1) {
        const task = currentTasks.value.splice(taskIndex, 1)[0]
        task.status = TaskStatus.CANCELLED
        completedTasks.value.unshift(task)
      }

      // 如果没有活跃任务了，隐藏面板
      if (currentTasks.value.length === 0) {
        hidePanel()
      }
    } catch (error) {
      console.error('Failed to cancel task:', error)
      throw error
    }
  }

  /**
   * 重试失败文件
   */
  async function retryFailed(taskId, filePaths) {
    try {
      await window.electronAPI.upload.retryFailed(taskId, filePaths)

      const task = currentTasks.value.find(t => t.id === taskId)
      if (task) {
        task.status = TaskStatus.RUNNING
      }
    } catch (error) {
      console.error('Failed to retry:', error)
      throw error
    }
  }

  /**
   * 更新任务进度
   */
  function updateProgress(taskId, progress) {
    taskProgress.value.set(taskId, progress)

    // 更新任务统计
    const task = currentTasks.value.find(t => t.id === taskId)
    if (task && progress.stats) {
      task.stats = progress.stats
    }
  }

  /**
   * 标记任务完成
   */
  function markTaskComplete(taskId, result) {
    const taskIndex = currentTasks.value.findIndex(t => t.id === taskId)
    if (taskIndex > -1) {
      const task = currentTasks.value.splice(taskIndex, 1)[0]
      task.status = TaskStatus.COMPLETED
      task.result = result
      completedTasks.value.unshift(task)
      taskProgress.value.delete(taskId)
    }

    // 自动开始下一个任务
    if (pendingTasks.value.length > 0 && runningTaskCount.value < concurrency.value) {
      const nextTask = pendingTasks.value[0]
      startTask(nextTask.id)
    }

    // 如果没有活跃任务了，最小化面板
    if (currentTasks.value.length === 0) {
      minimizePanel()
    }
  }

  /**
   * 标记任务错误
   */
  function markTaskError(taskId, error) {
    const task = currentTasks.value.find(t => t.id === taskId)
    if (task) {
      task.status = TaskStatus.ERROR
      task.error = error
    }
  }

  /**
   * 设置并发数
   */
  async function setConcurrency(value) {
    concurrency.value = value
    try {
      await window.electronAPI.upload.setConcurrency(value)
    } catch (error) {
      console.error('Failed to set concurrency:', error)
    }
  }

  /**
   * 设置自动调整并发
   */
  function setAutoAdjustConcurrency(enabled) {
    autoAdjustConcurrency.value = enabled
  }

  /**
   * 显示进度面板
   */
  function showPanel() {
    panelVisible.value = true
  }

  /**
   * 隐藏进度面板
   */
  function hidePanel() {
    panelVisible.value = false
  }

  /**
   * 切换面板显示
   */
  function togglePanel() {
    panelVisible.value = !panelVisible.value
  }

  /**
   * 最小化面板
   */
  function minimizePanel() {
    panelMinimized.value = true
  }

  /**
   * 展开面板
   */
  function expandPanel() {
    panelMinimized.value = false
  }

  /**
   * 获取任务进度
   */
  function getProgress(taskId) {
    return taskProgress.value.get(taskId)
  }

  /**
   * 获取所有任务
   */
  function getAllTasks() {
    return {
      current: currentTasks.value,
      pending: pendingTasks.value,
      completed: completedTasks.value
    }
  }

  /**
   * 清理已完成任务
   */
  function clearCompletedTasks() {
    completedTasks.value = []
  }

  return {
    // 状态
    currentTasks,
    pendingTasks,
    completedTasks,
    taskProgress,
    concurrency,
    autoAdjustConcurrency,
    panelMinimized,
    panelVisible,

    // 计算属性
    runningTaskCount,
    hasActiveTask,
    totalProgress,

    // Actions
    createTask,
    startTask,
    pauseTask,
    resumeTask,
    cancelTask,
    retryFailed,
    updateProgress,
    markTaskComplete,
    markTaskError,
    setConcurrency,
    setAutoAdjustConcurrency,
    showPanel,
    hidePanel,
    togglePanel,
    minimizePanel,
    expandPanel,
    getProgress,
    getAllTasks,
    clearCompletedTasks
  }
})
