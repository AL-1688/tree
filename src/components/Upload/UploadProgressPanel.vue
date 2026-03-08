<template>
  <Transition name="slide">
    <div v-if="visible" class="upload-progress-panel" :class="{ minimized }">
      <div class="panel-header">
        <div class="header-left">
          <el-icon class="upload-icon"><Upload /></el-icon>
          <span class="title">{{ minimized ? '上传中' : '上传进度' }}</span>
          <el-tag v-if="currentTask" :type="statusType" size="small">
            {{ statusText }}
          </el-tag>
        </div>
        <div class="header-actions">
          <el-button
            :icon="minimized ? 'ArrowUp' : 'Minus'"
            text
            size="small"
            @click="toggleMinimize"
          />
          <el-button
            icon="Close"
            text
            size="small"
            @click="handleClose"
          />
        </div>
      </div>

      <!-- 进度条 -->
      <div v-if="!minimized" class="panel-body">
        <el-progress
          :percentage="progress?.percent || 0"
          :stroke-width="8"
          :show-text="false"
          :status="progressStatus"
          class="progress-bar"
        />

        <!-- 当前文件 -->
        <div class="current-file">
          <el-icon class="file-icon"><Document /></el-icon>
          <span class="file-name" :title="currentFileName">
            {{ currentFileName || '准备中...' }}
          </span>
        </div>

        <!-- 统计信息 -->
        <div class="stats-row">
          <span class="stat-item">
            <el-icon><Odometer /></el-icon>
            {{ formatSpeed(uploadSpeed) }}/s
          </span>
          <span class="stat-item">
            <el-icon><Timer /></el-icon>
            {{ formatTime(estimatedTime) }}
          </span>
        </div>

        <!-- 操作按钮 -->
        <div class="action-buttons">
          <el-button
            v-if="currentTask?.status === 'running'"
            type="warning"
            size="small"
            @click="handlePause"
          >
            <el-icon><VideoPause /></el-icon>
            暂停
          </el-button>
          <el-button
            v-else-if="currentTask?.status === 'paused'"
            type="primary"
            size="small"
            @click="handleResume"
          >
            <el-icon><VideoPlay /></el-icon>
            继续
          </el-button>
          <el-button
            type="danger"
            size="small"
            plain
            @click="handleCancel"
          >
            <el-icon><Close /></el-icon>
            取消
          </el-button>
        </div>

        <!-- 失败文件提示 -->
        <div v-if="failedCount > 0" class="failed-tip">
          <el-icon class="warning-icon"><WarningFilled /></el-icon>
          <span>{{ failedCount }} 个文件上传失败</span>
          <el-button type="primary" text size="small" @click="handleRetry">
            重试
          </el-button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useUploadStore } from '../../stores/upload'
import {
  Upload,
  Document,
  Odometer,
  Timer,
  VideoPause,
  VideoPlay,
  Close,
  WarningFilled
} from '@element-plus/icons-vue'

const props = defineProps({
  minimized: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'expand', 'minimize'])

const uploadStore = useUploadStore()

// 计算属性
const visible = computed(() => uploadStore.panelVisible && uploadStore.hasActiveTask)
const progress = computed(() => uploadStore.totalProgress)
const currentTask = computed(() => uploadStore.currentTasks[0])
const currentFileName = computed(() => {
  if (!currentTask.value) return ''
  const progress = uploadStore.getProgress(currentTask.value.id)
  return progress?.currentFile || ''
})
const uploadSpeed = computed(() => {
  if (!currentTask.value) return 0
  const progress = uploadStore.getProgress(currentTask.value.id)
  return progress?.stats?.uploadSpeed || 0
})
const estimatedTime = computed(() => {
  if (!currentTask.value) return 0
  const progress = uploadStore.getProgress(currentTask.value.id)
  return progress?.stats?.estimatedTime || 0
})
const failedCount = computed(() => currentTask.value?.stats?.failedFiles || 0)

const statusType = computed(() => {
  if (!currentTask.value) return 'info'
  const statusMap = {
    pending: 'info',
    running: 'primary',
    paused: 'warning',
    completed: 'success',
    cancelled: 'info',
    error: 'danger'
  }
  return statusMap[currentTask.value.status] || 'info'
})

const statusText = computed(() => {
  if (!currentTask.value) return ''
  const textMap = {
    pending: '等待中',
    running: '上传中',
    paused: '已暂停',
    completed: '已完成',
    cancelled: '已取消',
    error: '失败'
  }
  return textMap[currentTask.value.status] || ''
})

const progressStatus = computed(() => {
  if (!currentTask.value) return undefined
  if (currentTask.value.status === 'completed') return 'success'
  if (currentTask.value.status === 'error') return 'exception'
  if (failedCount.value > 0) return 'warning'
  return undefined
})

// 方法
function toggleMinimize() {
  if (props.minimized) {
    emit('expand')
    uploadStore.expandPanel()
  } else {
    emit('minimize')
    uploadStore.minimizePanel()
  }
}

function handleClose() {
  emit('close')
  uploadStore.hidePanel()
}

function handlePause() {
  if (currentTask.value) {
    uploadStore.pauseTask(currentTask.value.id)
  }
}

function handleResume() {
  if (currentTask.value) {
    uploadStore.resumeTask(currentTask.value.id)
  }
}

function handleCancel() {
  if (currentTask.value) {
    uploadStore.cancelTask(currentTask.value.id)
  }
}

function handleRetry() {
  if (currentTask.value) {
    uploadStore.retryFailed(currentTask.value.id)
  }
}

function formatSpeed(bytesPerSecond) {
  if (bytesPerSecond < 1024) return bytesPerSecond + ' B'
  if (bytesPerSecond < 1024 * 1024) return (bytesPerSecond / 1024).toFixed(1) + ' KB'
  return (bytesPerSecond / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatTime(seconds) {
  if (seconds < 60) return seconds + '秒'
  if (seconds < 3600) return Math.floor(seconds / 60) + '分' + (seconds % 60) + '秒'
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return hours + '时' + mins + '分'
}

// 监听上传进度事件
function handleUploadProgress(event, progressData) {
  uploadStore.updateProgress(progressData.taskId, progressData)
}

function handleTaskComplete(event, result) {
  uploadStore.markTaskComplete(result.taskId, result)
}

function handleTaskError(event, error) {
  uploadStore.markTaskError(error.taskId, error)
}

onMounted(() => {
  // 监听主进程的上传事件
  if (window.electronAPI?.upload?.onProgress) {
    window.electronAPI.upload.onProgress(handleUploadProgress)
  }
  if (window.electronAPI?.upload?.onTaskComplete) {
    window.electronAPI.upload.onTaskComplete(handleTaskComplete)
  }
  if (window.electronAPI?.upload?.onTaskError) {
    window.electronAPI.upload.onTaskError(handleTaskError)
  }
})

onUnmounted(() => {
  if (window.electronAPI?.upload?.removeProgressListener) {
    window.electronAPI.upload.removeProgressListener()
  }
})
</script>

<style scoped>
.upload-progress-panel {
  position: fixed;
  right: 20px;
  bottom: 20px;
  width: 320px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 2000;
  overflow: hidden;
}

.upload-progress-panel.minimized {
  width: 200px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-color);
  border-bottom: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.upload-icon {
  color: var(--primary-color);
}

.title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
}

.header-actions {
  display: flex;
  gap: 4px;
}

.panel-body {
  padding: 16px;
}

.progress-bar {
  margin-bottom: 12px;
}

.current-file {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.file-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.file-name {
  font-size: 13px;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stats-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.action-buttons .el-button {
  flex: 1;
}

.failed-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 12px;
  background: #fef0f0;
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--error-color);
}

.warning-icon {
  color: var(--warning-color);
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
