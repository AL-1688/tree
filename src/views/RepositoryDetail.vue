<template>
  <div class="repository-detail">
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="!repository" class="error-state">
      <p>仓库不存在或加载失败</p>
      <button @click="$router.back()" class="btn-secondary">返回</button>
    </div>

    <div v-else class="repo-content">
      <header class="repo-header">
        <div class="repo-title">
          <button @click="$router.back()" class="back-btn">
            <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
              <path d="M7.78 12.53a.75.75 0 01-1.06 0L2.47 8.28a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 1.06L4.81 7h7.44a.75.75 0 010 1.5H4.81l2.97 2.97a.75.75 0 010 1.06z"></path>
            </svg>
          </button>
          <h1>{{ repository.full_name }}</h1>
          <span :class="['visibility-badge', repository.private ? 'private' : 'public']">
            {{ repository.private ? '私有' : '公开' }}
          </span>
        </div>
        <div class="repo-actions">
          <button @click="goToSettings" class="btn-secondary">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0zm7.25-3.25a.75.75 0 00-1.5 0v3.5c0 .199.079.39.22.53l2 2a.75.75 0 101.06-1.06l-1.78-1.78V4.75z"></path>
            </svg>
            设置
          </button>
        </div>
      </header>

      <div class="repo-stats">
        <div class="stat-item">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25zm0 2.445L6.615 5.5a.75.75 0 01-.564.41l-3.097.45 2.24 2.184a.75.75 0 01.216.664l-.528 3.084 2.769-1.456a.75.75 0 01.698 0l2.77 1.456-.53-3.084a.75.75 0 01.216-.664l2.24-2.183-3.096-.45a.75.75 0 01-.564-.41L8 2.694z"></path>
          </svg>
          <span>{{ repository.stargazers_count }} 星标</span>
        </div>
        <div class="stat-item">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm9 3a1 1 0 11-2 0 1 1 0 012 0zM7.068 5.584c.236-.264.591-.396.932-.396.341 0 .696.132.932.396a.75.75 0 101.06-1.06A2.75 2.75 0 008 3.438c-.7 0-1.363.265-1.86.78a.75.75 0 001.06 1.06 1.25 1.25 0 01.868-.694z"></path>
          </svg>
          <span>{{ repository.forks_count }} 复刻</span>
        </div>
        <div v-if="repository.language" class="stat-item">
          <span class="language-dot" :style="{ backgroundColor: getLanguageColor(repository.language) }"></span>
          <span>{{ repository.language }}</span>
        </div>
      </div>

      <p class="repo-description">{{ repository.description || '暂无描述' }}</p>

      <div class="repo-content-section">
        <div class="section-header">
          <h2>文件</h2>
          <div class="actions">
            <button @click="uploadFolder" class="btn-primary">
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                <path d="M9.5 1.1l3.4 3.5.1.4v10h-11V1h7.6l.1.1zM9 2H3v12h9V6H9.5L9 5.5V2zm1 0v3h2.9L10 2zm-1 7h2v1H9v2H8V10H6V9h2V7h1v2z"></path>
              </svg>
              上传文件夹
            </button>
          </div>
        </div>

        <div v-if="loadingFiles" class="loading-small">
          加载文件列表...
        </div>

        <div v-else-if="files.length === 0" class="empty-state">
          <p>仓库为空</p>
        </div>

        <div v-else class="file-list">
          <div
            v-for="file in files"
            :key="file.path"
            class="file-item"
            @click="handleFileClick(file)"
          >
            <div class="file-icon">
              <svg v-if="file.type === 'dir'" viewBox="0 0 16 16" width="20" height="20" fill="#7f8c8d">
                <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z"></path>
              </svg>
              <svg v-else viewBox="0 0 16 16" width="20" height="20" fill="#95a5a6">
                <path d="M3.75 1.5a.25.25 0 00-.25.25v11.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75zm5.75.56v2.19c0 .138.112.25.25.25h2.19L9.5 2.06zM2 1.75C2 .784 2.784 0 3.75 0h5.086c.464 0 .909.184 1.237.513l3.414 3.414c.329.328.513.773.513 1.237v8.086A1.75 1.75 0 0112.25 15h-8.5A1.75 1.75 0 012 13.25V1.75z"></path>
              </svg>
            </div>
            <div class="file-info">
              <span class="file-name">{{ file.name }}</span>
              <span v-if="file.size" class="file-size">{{ formatSize(file.size) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 上传文件夹对话框 -->
    <div v-if="showUploadDialog" class="dialog-overlay" @click="showUploadDialog = false">
      <div class="dialog upload-dialog" @click.stop>
        <h2>上传文件夹</h2>

        <div class="upload-section">
          <button @click="selectFolder" class="btn-secondary full-width">
            选择本地文件夹
          </button>

          <div v-if="selectedFolder" class="folder-preview">
            <h3>{{ selectedFolder.name }}</h3>
            <p>{{ folderStats.totalFiles }} 个文件, 共 {{ formatSize(folderStats.totalSize) }}</p>

            <div class="target-path">
              <label>目标路径:</label>
              <input v-model="targetPath" type="text" placeholder="留空则上传到根目录" />
            </div>

            <div class="file-list-preview">
              <div v-for="file in previewFiles" :key="file.path" class="preview-file">
                <span class="file-name">{{ file.name }}</span>
                <span class="file-size">{{ formatSize(file.size) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button @click="showUploadDialog = false" class="btn-secondary">取消</button>
          <button @click="startUpload" class="btn-primary" :disabled="!selectedFolder || uploading">
            {{ uploading ? '上传中...' : '开始上传' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRepositoryStore } from '../stores/repository'

const route = useRoute()
const router = useRouter()
const repoStore = useRepositoryStore()

const loading = computed(() => repoStore.loading)
const repository = computed(() => repoStore.currentRepository)

const files = ref([])
const loadingFiles = ref(false)
const showUploadDialog = ref(false)
const selectedFolder = ref(null)
const folderStats = ref({ totalFiles: 0, totalSize: 0 })
const previewFiles = ref([])
const targetPath = ref('')
const uploading = ref(false)

onMounted(async () => {
  const { owner, repo } = route.params
  await repoStore.fetchRepository(owner, repo)
  await loadFiles()
})

async function loadFiles(path = '') {
  loadingFiles.value = true
  try {
    const { owner, repo } = route.params
    const data = await window.electronAPI.api.getRepositoryContent({
      owner,
      repo,
      path
    })
    files.value = Array.isArray(data) ? data : [data]
  } catch (error) {
    console.error('Failed to load files:', error)
  } finally {
    loadingFiles.value = false
  }
}

function handleFileClick(file) {
  const { owner, repo } = route.params

  if (file.type === 'dir') {
    router.push(`/repository/${owner}/${repo}/browse/${file.path}`)
  } else {
    // TODO: 打开文件预览
    router.push(`/repository/${owner}/${repo}/browse/${file.path}`)
  }
}

function goToSettings() {
  const { owner, repo } = route.params
  router.push(`/repository/${owner}/${repo}/settings`)
}

function uploadFolder() {
  showUploadDialog.value = true
  selectedFolder.value = null
  previewFiles.value = []
}

async function selectFolder() {
  try {
    const folderPath = await window.electronAPI.fs.selectFolder()
    if (folderPath) {
      const structure = await window.electronAPI.fs.readFolderStructure(folderPath)
      selectedFolder.value = structure

      // 计算统计信息
      let totalFiles = 0
      let totalSize = 0
      const allFiles = []

      function traverse(node) {
        if (node.type === 'file') {
          totalFiles++
          totalSize += node.size || 0
          allFiles.push(node)
        } else if (node.children) {
          node.children.forEach(traverse)
        }
      }

      traverse(structure)

      folderStats.value = { totalFiles, totalSize }
      previewFiles.value = allFiles.slice(0, 20) // 只预览前 20 个文件
    }
  } catch (error) {
    console.error('Failed to select folder:', error)
  }
}

async function startUpload() {
  if (!selectedFolder.value) return

  uploading.value = true
  try {
    const { owner, repo } = route.params
    const allFiles = []

    function traverse(node, basePath = '') {
      if (node.type === 'file') {
        const filePath = targetPath.value
          ? `${targetPath.value}/${basePath}/${node.name}`
          : `${basePath}/${node.name}`.replace(/^\/+/, '')

        allFiles.push({
          owner,
          repo,
          path: filePath,
          content: 'File content placeholder', // TODO: 读取实际文件内容
          message: `Upload ${node.name}`
        })
      } else if (node.children) {
        node.children.forEach(child => {
          const newBasePath = basePath ? `${basePath}/${node.name}` : node.name
          traverse(child, newBasePath)
        })
      }
    }

    traverse(selectedFolder.value)

    // 批量上传
    for (const file of allFiles) {
      await window.electronAPI.api.uploadFile(file)
    }

    showUploadDialog.value = false
    await loadFiles()
  } catch (error) {
    console.error('Failed to upload:', error)
    alert('上传失败: ' + error.message)
  } finally {
    uploading.value = false
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}

function getLanguageColor(language) {
  const colors = {
    JavaScript: '#f1e05a',
    TypeScript: '#2b7489',
    Python: '#3572A5',
    Java: '#b07219',
    'C++': '#f34b7d',
    C: '#555555',
    'C#': '#178600',
    Go: '#00ADD8',
    Rust: '#dea584',
    Ruby: '#701516',
    PHP: '#4F5D95',
    Swift: '#ffac45',
    Kotlin: '#F18E33',
    Vue: '#41b883',
    HTML: '#e34c26',
    CSS: '#563d7c'
  }
  return colors[language] || '#8e8e8e'
}
</script>

<style scoped>
.repository-detail {
  max-width: 1200px;
  margin: 0 auto;
}

.loading, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: var(--text-color);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.repo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.repo-title {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.back-btn:hover {
  background: var(--border-color);
}

.repo-title h1 {
  font-size: 28px;
  font-weight: 600;
  color: var(--text-color);
}

.visibility-badge {
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 500;
}

.visibility-badge.public {
  background: #e8f5e9;
  color: #2e7d32;
}

.visibility-badge.private {
  background: #fff3e0;
  color: #e65100;
}

.repo-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #7f8c8d;
  font-size: 14px;
}

.language-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.repo-description {
  color: #7f8c8d;
  font-size: 16px;
  margin-bottom: 32px;
}

.repo-content-section {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-color);
}

.file-list {
  display: flex;
  flex-direction: column;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.file-item:hover {
  background: rgba(102, 126, 234, 0.1);
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

.file-size {
  font-size: 13px;
  color: #7f8c8d;
}

.loading-small {
  padding: 40px;
  text-align: center;
  color: #7f8c8d;
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: #7f8c8d;
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
  padding: 32px;
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
}

.upload-dialog {
  max-width: 640px;
}

.dialog h2 {
  font-size: 24px;
  margin-bottom: 24px;
  color: var(--text-color);
}

.upload-section {
  margin-bottom: 24px;
}

.full-width {
  width: 100%;
}

.folder-preview {
  margin-top: 20px;
  padding: 16px;
  background: var(--bg-color);
  border-radius: 8px;
}

.folder-preview h3 {
  font-size: 16px;
  margin-bottom: 8px;
  color: var(--text-color);
}

.folder-preview p {
  font-size: 14px;
  color: #7f8c8d;
  margin-bottom: 16px;
}

.target-path {
  margin-bottom: 16px;
}

.target-path label {
  display: block;
  font-size: 14px;
  color: var(--text-color);
  margin-bottom: 8px;
}

.target-path input {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--card-bg);
  color: var(--text-color);
}

.file-list-preview {
  max-height: 200px;
  overflow-y: auto;
}

.preview-file {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
}

.preview-file:last-child {
  border-bottom: none;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
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
  display: flex;
  align-items: center;
  gap: 8px;
  transition: opacity 0.2s;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 10px 20px;
  background: transparent;
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: var(--border-color);
}
</style>
