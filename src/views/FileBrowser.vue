<template>
  <div class="file-browser">
    <header class="browser-header">
      <div class="breadcrumb">
        <button @click="goToRepo" class="breadcrumb-item">
          {{ repository?.name }}
        </button>
        <span v-for="(part, index) in pathParts" :key="index" class="breadcrumb-separator">/</span>
        <button
          v-for="(part, index) in pathParts"
          :key="`part-${index}`"
          @click="navigateToPath(index)"
          class="breadcrumb-item"
        >
          {{ part }}
        </button>
      </div>
      <div class="actions">
        <button @click="uploadFolder" class="btn-primary">
          上传文件
        </button>
      </div>
    </header>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <div v-else-if="files.length === 0" class="empty-state">
      <p>此文件夹为空</p>
      <button @click="uploadFolder" class="btn-primary">上传文件</button>
    </div>

    <div v-else class="file-list">
      <div
        v-for="file in files"
        :key="file.path"
        class="file-item"
        @click="handleFileClick(file)"
      >
        <div class="file-icon">
          <svg v-if="file.type === 'dir'" viewBox="0 0 16 16" width="24" height="24" fill="#7f8c8d">
            <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z"></path>
          </svg>
          <svg v-else viewBox="0 0 16 16" width="24" height="24" fill="#95a5a6">
            <path d="M3.75 1.5a.25.25 0 00-.25.25v11.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75zm5.75.56v2.19c0 .138.112.25.25.25h2.19L9.5 2.06zM2 1.75C2 .784 2.784 0 3.75 0h5.086c.464 0 .909.184 1.237.513l3.414 3.414c.329.328.513.773.513 1.237v8.086A1.75 1.75 0 0112.25 15h-8.5A1.75 1.75 0 012 13.25V1.75z"></path>
          </svg>
        </div>
        <div class="file-info">
          <span class="file-name">{{ file.name }}</span>
          <span class="file-meta">
            <span v-if="file.size">{{ formatSize(file.size) }}</span>
            <span v-if="file.type === 'file'" class="file-actions">
              <button @click.stop="viewFile(file)" class="action-btn">查看</button>
              <button @click.stop="editFile(file)" class="action-btn">编辑</button>
              <button @click.stop="deleteFile(file)" class="action-btn delete">删除</button>
            </span>
          </span>
        </div>
      </div>
    </div>

    <!-- 文件预览对话框 -->
    <div v-if="showPreview && currentFile" class="dialog-overlay" @click="showPreview = false">
      <div class="dialog preview-dialog" @click.stop>
        <div class="preview-header">
          <h2>{{ currentFile.name }}</h2>
          <button @click="editFile(currentFile)" class="btn-secondary">编辑</button>
        </div>
        <div class="preview-content">
          <pre><code>{{ fileContent }}</code></pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRepositoryStore } from '../stores/repository'

const route = useRoute()
const router = useRouter()
const repoStore = useRepositoryStore()

const repository = computed(() => repoStore.currentRepository)
const currentPath = computed(() => {
  const path = route.params.pathMatch || ''
  return Array.isArray(path) ? path.join('/') : path
})

const pathParts = computed(() => {
  return currentPath.value ? currentPath.value.split('/').filter(Boolean) : []
})

const files = ref([])
const loading = ref(false)
const showPreview = ref(false)
const currentFile = ref(null)
const fileContent = ref('')

onMounted(async () => {
  const { owner, repo } = route.params
  if (!repoStore.currentRepository) {
    await repoStore.fetchRepository(owner, repo)
  }
  await loadFiles()
})

watch(currentPath, () => {
  loadFiles()
})

async function loadFiles() {
  loading.value = true
  try {
    const { owner, repo } = route.params
    const data = await window.electronAPI.api.getRepositoryContent({
      owner,
      repo,
      path: currentPath.value
    })
    files.value = Array.isArray(data) ? data : [data]
  } catch (error) {
    console.error('Failed to load files:', error)
  } finally {
    loading.value = false
  }
}

function handleFileClick(file) {
  if (file.type === 'dir') {
    const { owner, repo } = route.params
    const newPath = currentPath.value ? `${currentPath.value}/${file.name}` : file.name
    router.push(`/repository/${owner}/${repo}/browse/${newPath}`)
  } else {
    viewFile(file)
  }
}

async function viewFile(file) {
  currentFile.value = file
  showPreview.value = true

  try {
    const { owner, repo } = route.params
    const content = await window.electronAPI.api.getFileContent({
      owner,
      repo,
      path: file.path
    })
    fileContent.value = content
  } catch (error) {
    console.error('Failed to load file:', error)
    fileContent.value = '无法加载文件内容'
  }
}

function editFile(file) {
  const { owner, repo } = route.params
  router.push(`/repository/${owner}/${repo}/edit/${file.path}`)
}

async function deleteFile(file) {
  if (!confirm(`确定要删除 ${file.name} 吗?`)) return

  try {
    const { owner, repo } = route.params
    await window.electronAPI.api.deleteFile({
      owner,
      repo,
      path: file.path,
      message: `Delete ${file.name}`,
      sha: file.sha
    })
    await loadFiles()
  } catch (error) {
    console.error('Failed to delete file:', error)
    alert('删除失败: ' + error.message)
  }
}

function navigateToPath(index) {
  const { owner, repo } = route.params
  const newPath = pathParts.value.slice(0, index + 1).join('/')
  router.push(`/repository/${owner}/${repo}/browse/${newPath}`)
}

function goToRepo() {
  const { owner, repo } = route.params
  router.push(`/repository/${owner}/${repo}`)
}

function uploadFolder() {
  // TODO: 实现文件上传
  alert('上传功能开发中...')
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>

<style scoped>
.file-browser {
  max-width: 1200px;
  margin: 0 auto;
}

.browser-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 15px;
}

.breadcrumb-item {
  background: none;
  border: none;
  color: var(--primary-color);
  cursor: pointer;
  font-size: 15px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.breadcrumb-item:hover {
  background: rgba(102, 126, 234, 0.1);
}

.breadcrumb-separator {
  color: #95a5a6;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 80px 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: #7f8c8d;
  gap: 16px;
}

.file-list {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background 0.2s;
}

.file-item:last-child {
  border-bottom: none;
}

.file-item:hover {
  background: rgba(102, 126, 234, 0.05);
}

.file-icon {
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.file-name {
  font-size: 15px;
  color: var(--text-color);
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: #95a5a6;
}

.file-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--text-color);
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--border-color);
}

.action-btn.delete {
  color: #c33;
  border-color: #fcc;
}

.action-btn.delete:hover {
  background: #fee;
}

/* 对话框样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--card-bg);
  border-radius: 12px;
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.preview-dialog {
  height: 80vh;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
}

.preview-header h2 {
  font-size: 18px;
  color: var(--text-color);
}

.preview-content {
  flex: 1;
  overflow: auto;
  padding: 24px;
}

.preview-content pre {
  margin: 0;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-color);
}

.btn-primary {
  padding: 10px 20px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  padding: 10px 20px;
  background: transparent;
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: var(--border-color);
}
</style>
