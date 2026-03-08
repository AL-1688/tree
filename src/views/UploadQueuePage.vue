<template>
  <div class="upload-queue-page">
    <div class="page-header">
      <h2>上传队列</h2>
      <div class="header-actions">
        <el-select
          v-model="filterStatus"
          placeholder="筛选状态"
          clearable
          size="small"
          style="width: 120px"
        >
          <el-option label="全部" value="" />
          <el-option label="上传中" value="running" />
          <el-option label="等待中" value="pending" />
          <el-option label="已暂停" value="paused" />
          <el-option label="已完成" value="completed" />
          <el-option label="失败" value="error" />
        </el-select>
        <el-button type="primary" @click="handleNewUpload">
          <el-icon><Upload /></el-icon>
          新建上传
        </el-button>
      </div>
    </div>

    <!-- 任务列表 -->
    <div class="task-list">
      <el-empty v-if="filteredTasks.length === 0" description="暂无上传任务" />

      <div
        v-for="task in filteredTasks"
        :key="task.id"
        class="task-card"
        :class="task.status"
      >
        <div class="task-header">
          <div class="task-info">
            <div class="task-repo">
              <el-icon><Folder /></el-icon>
              <span class="repo-name">{{ task.owner }}/{{ task.repo }}</span>
              <el-tag :type="getStatusType(task.status)" size="small">
                {{ getStatusText(task.status) }}
              </el-tag>
            </div>
            <div class="task-time">
              {{ formatTime(task.createdAt) }}
            </div>
          </div>
          <div class="task-actions">
            <el-button
              v-if="task.status === 'running'"
              type="warning"
              size="small"
              @click="handlePause(task.id)"
            >
              <el-icon><VideoPause /></el-icon>
              暂停
            </el-button>
            <el-button
              v-else-if="task.status === 'paused'"
              type="primary"
              size="small"
              @click="handleResume(task.id)"
            >
              <el-icon><VideoPlay /></el-icon>
              继续
            </el-button>
            <el-button
              v-if="task.status === 'pending'"
              type="primary"
              size="small"
              @click="handleStart(task.id)"
            >
              <el-icon><CaretRight /></el-icon>
              开始
            </el-button>
            <el-button
              v-if="task.status === 'error'"
              type="primary"
              size="small"
              @click="handleRetry(task.id)"
            >
              <el-icon><RefreshRight /></el-icon>
              重试
            </el-button>
            <el-button
              v-if="canCancel(task.status)"
              type="danger"
              size="small"
              plain
              @click="handleCancel(task.id)"
            >
              <el-icon><Close /></el-icon>
              取消
            </el-button>
            <el-button
              v-if="isFinished(task.status)"
              type="info"
              size="small"
              text
              @click="handleRemove(task.id)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>

        <!-- 进度信息 -->
        <div class="task-progress">
          <el-progress
            :percentage="getTaskProgress(task)"
            :status="getProgressStatus(task.status)"
            :stroke-width="6"
          />
          <div class="progress-stats">
            <span>
              {{ task.stats?.completedFiles || 0 }} / {{ task.stats?.totalFiles || 0 }} 文件
            </span>
            <span>{{ formatSize(task.stats?.completedSize || 0) }} / {{ formatSize(task.stats?.totalSize || 0) }}</span>
            <span v-if="task.status === 'running' && taskProgress[task.id]?.stats?.uploadSpeed">
              {{ formatSpeed(taskProgress[task.id].stats.uploadSpeed) }}/s
            </span>
            <span v-if="task.status === 'running' && taskProgress[task.id]?.stats?.estimatedTime">
              剩余 {{ formatTime(taskProgress[task.id].stats.estimatedTime) }}
            </span>
          </div>
        </div>

        <!-- 失败文件列表 -->
        <div v-if="task.stats?.failedFiles > 0" class="failed-files">
          <el-collapse>
            <el-collapse-item>
              <template #title>
                <div class="failed-title">
                  <el-icon class="warning-icon"><WarningFilled /></el-icon>
                  <span>{{ task.stats.failedFiles }} 个文件上传失败</span>
                </div>
              </template>
              <div class="failed-list">
                <div
                  v-for="file in getFailedFiles(task.id)"
                  :key="file.path"
                  class="failed-item"
                >
                  <span class="file-path">{{ file.path }}</span>
                  <span class="error-msg">{{ file.error }}</span>
                </div>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>
      </div>
    </div>

    <!-- 并发设置 -->
    <div class="concurrency-setting">
      <span class="setting-label">并发数：</span>
      <el-slider
        v-model="concurrency"
        :min="1"
        :max="10"
        :marks="concurrencyMarks"
        :disabled="hasRunningTask"
        style="width: 200px"
      />
      <el-checkbox v-model="autoAdjustConcurrency" style="margin-left: 16px">
        自适应调整
      </el-checkbox>
    </div>

    <!-- 新建上传对话框 -->
    <el-dialog
      v-model="showNewUploadDialog"
      title="新建上传任务"
      width="500px"
    >
      <el-form :model="newUploadForm" label-width="80px">
        <el-form-item label="本地目录">
          <el-input
            v-model="newUploadForm.folderPath"
            placeholder="选择要上传的文件夹"
            readonly
          >
            <template #append>
              <el-button @click="selectFolder">选择</el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="目标仓库">
          <el-select
            v-model="newUploadForm.repo"
            placeholder="选择目标仓库"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="repo in repositories"
              :key="repo.full_name"
              :label="repo.full_name"
              :value="repo.full_name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="目标分支">
          <el-input v-model="newUploadForm.branch" placeholder="默认为 main" />
        </el-form-item>
        <el-form-item label="目标路径">
          <el-input v-model="newUploadForm.targetPath" placeholder="留空则上传到根目录" />
        </el-form-item>
        <el-form-item label="冲突处理">
          <el-radio-group v-model="newUploadForm.conflictStrategy">
            <el-radio label="overwrite">覆盖</el-radio>
            <el-radio label="skip">跳过</el-radio>
            <el-radio label="rename">重命名</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showNewUploadDialog = false">取消</el-button>
        <el-button type="primary" @click="createUploadTask" :loading="creating">
          创建任务
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUploadStore } from '../stores/upload'
import {
  Upload,
  Folder,
  VideoPause,
  VideoPlay,
  CaretRight,
  RefreshRight,
  Close,
  Delete,
  WarningFilled
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const uploadStore = useUploadStore()

// 筛选状态
const filterStatus = ref('')

// 任务进度
const taskProgress = ref({})

// 并发设置
const concurrency = ref(3)
const autoAdjustConcurrency = ref(true)
const concurrencyMarks = {
  1: '1',
  3: '3',
  5: '5',
  10: '10'
}

// 新建上传
const showNewUploadDialog = ref(false)
const creating = ref(false)
const repositories = ref([])
const newUploadForm = ref({
  folderPath: '',
  repo: '',
  branch: 'main',
  targetPath: '',
  conflictStrategy: 'overwrite'
})

// 计算属性
const filteredTasks = computed(() => {
  const allTasks = [
    ...uploadStore.currentTasks,
    ...uploadStore.pendingTasks,
    ...uploadStore.completedTasks
  ]

  if (!filterStatus.value) {
    return allTasks
  }

  return allTasks.filter(task => task.status === filterStatus.value)
})

const hasRunningTask = computed(() => {
  return uploadStore.currentTasks.some(t => t.status === 'running')
})

// 方法
function getStatusType(status) {
  const map = {
    pending: 'info',
    running: 'primary',
    paused: 'warning',
    completed: 'success',
    cancelled: 'info',
    error: 'danger'
  }
  return map[status] || 'info'
}

function getStatusText(status) {
  const map = {
    pending: '等待中',
    running: '上传中',
    paused: '已暂停',
    completed: '已完成',
    cancelled: '已取消',
    error: '失败'
  }
  return map[status] || status
}

function getTaskProgress(task) {
  if (taskProgress.value[task.id]) {
    return taskProgress.value[task.id].progress || 0
  }
  if (task.stats?.totalSize > 0) {
    return Math.round((task.stats.completedSize / task.stats.totalSize) * 100)
  }
  return 0
}

function getProgressStatus(status) {
  if (status === 'completed') return 'success'
  if (status === 'error') return 'exception'
  return undefined
}

function canCancel(status) {
  return ['pending', 'running', 'paused'].includes(status)
}

function isFinished(status) {
  return ['completed', 'cancelled', 'error'].includes(status)
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatSpeed(bytesPerSecond) {
  return formatSize(bytesPerSecond)
}

function formatTime(timestamp) {
  if (typeof timestamp === 'number') {
    // 秒数转时间字符串
    const seconds = timestamp
    if (seconds < 60) return seconds + '秒'
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return mins + '分' + secs + '秒'
    }
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return hours + '时' + mins + '分'
  }
  // ISO 时间字符串
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN')
}

function getFailedFiles(taskId) {
  // 从 store 或本地获取失败文件列表
  const task = uploadStore.currentTasks.find(t => t.id === taskId) ||
    uploadStore.completedTasks.find(t => t.id === taskId)
  if (!task?.files) return []
  return task.files.filter(f => f.status === 'failed')
}

// 操作处理
function handleNewUpload() {
  showNewUploadDialog.value = true
  loadRepositories()
}

async function selectFolder() {
  try {
    const result = await window.electronAPI.fs.selectFolder()
    if (result) {
      newUploadForm.value.folderPath = result
    }
  } catch (error) {
    ElMessage.error('选择文件夹失败：' + error.message)
  }
}

async function loadRepositories() {
  try {
    const repos = await window.electronAPI.api.getRepositories({ per_page: 100 })
    repositories.value = repos || []
  } catch (error) {
    console.error('Failed to load repositories:', error)
  }
}

async function createUploadTask() {
  if (!newUploadForm.value.folderPath) {
    ElMessage.warning('请选择要上传的文件夹')
    return
  }
  if (!newUploadForm.value.repo) {
    ElMessage.warning('请选择目标仓库')
    return
  }

  creating.value = true
  try {
    const [owner, repo] = newUploadForm.value.repo.split('/')
    const result = await uploadStore.createTask({
      folderPath: newUploadForm.value.folderPath,
      owner,
      repo,
      branch: newUploadForm.value.branch || 'main',
      targetPath: newUploadForm.value.targetPath,
      conflictStrategy: newUploadForm.value.conflictStrategy
    })

    if (result.success) {
      ElMessage.success('任务创建成功')
      showNewUploadDialog.value = false
      // 自动开始任务
      await uploadStore.startTask(result.task.id)
    } else {
      ElMessage.error(result.error || '创建任务失败')
    }
  } catch (error) {
    ElMessage.error('创建任务失败：' + error.message)
  } finally {
    creating.value = false
  }
}

function handleStart(taskId) {
  uploadStore.startTask(taskId)
}

function handlePause(taskId) {
  uploadStore.pauseTask(taskId)
}

function handleResume(taskId) {
  uploadStore.resumeTask(taskId)
}

function handleCancel(taskId) {
  uploadStore.cancelTask(taskId)
}

function handleRetry(taskId) {
  uploadStore.retryFailed(taskId)
}

function handleRemove(taskId) {
  uploadStore.removeTask(taskId)
}

// 监听上传进度
function handleUploadProgress(event, progressData) {
  taskProgress.value[progressData.taskId] = progressData
}

onMounted(() => {
  // 加载任务列表
  uploadStore.loadTasks()

  // 监听进度
  if (window.electronAPI?.upload?.onProgress) {
    window.electronAPI.upload.onProgress(handleUploadProgress)
  }
})

onUnmounted(() => {
  if (window.electronAPI?.upload?.removeProgressListener) {
    window.electronAPI.upload.removeProgressListener()
  }
})
</script>

<style scoped>
.upload-queue-page {
  padding: var(--spacing-lg);
  max-width: 1000px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  color: var(--text-color);
}

.header-actions {
  display: flex;
  gap: 12px;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.task-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  transition: box-shadow 0.2s;
}

.task-card:hover {
  box-shadow: var(--shadow-md);
}

.task-card.running {
  border-color: var(--primary-color);
}

.task-card.error {
  border-color: var(--error-color);
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.task-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-repo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.repo-name {
  font-weight: 500;
  color: var(--text-color);
}

.task-time {
  font-size: 12px;
  color: var(--text-secondary);
}

.task-actions {
  display: flex;
  gap: 8px;
}

.task-progress {
  margin-bottom: 8px;
}

.progress-stats {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.failed-files {
  margin-top: 12px;
}

.failed-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--error-color);
}

.failed-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.failed-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: #fef0f0;
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.file-path {
  color: var(--text-color);
}

.error-msg {
  color: var(--error-color);
}

.concurrency-setting {
  display: flex;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  margin-top: var(--spacing-lg);
}

.setting-label {
  font-size: 14px;
  color: var(--text-color);
  margin-right: 12px;
}
</style>
