<template>
  <div class="search-page">
    <header class="search-header">
      <h1>探索 GitHub 项目</h1>
    </header>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索仓库..."
        @keyup.enter="handleSearch"
        class="search-input"
      />
      <button @click="handleSearch" class="btn-primary">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M10.68 11.74a6 6 0 01-7.922-8.984 6 6 0 018.984 7.922l3.04 3.04a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215l-3.04-3.04zm-5.354-1.275a4.5 4.5 0 106.364-6.364 4.5 4.5 0 01-6.364 6.364z"></path>
        </svg>
        搜索
      </button>
    </div>

    <!-- 过滤器 -->
    <div class="filters">
      <select v-model="languageFilter" @change="handleFilterChange" class="filter-select">
        <option value="">所有语言</option>
        <option value="JavaScript">JavaScript</option>
        <option value="TypeScript">TypeScript</option>
        <option value="Python">Python</option>
        <option value="Java">Java</option>
        <option value="Go">Go</option>
        <option value="Rust">Rust</option>
        <option value="C++">C++</option>
        <option value="C">C</option>
        <option value="Ruby">Ruby</option>
        <option value="PHP">PHP</option>
        <option value="Vue">Vue</option>
        <option value="HTML">HTML</option>
        <option value="CSS">CSS</option>
      </select>

      <select v-model="sortFilter" @change="handleFilterChange" class="filter-select">
        <option value="best-match">最佳匹配</option>
        <option value="stars">星标数</option>
        <option value="forks">复刻数</option>
        <option value="updated">最近更新</option>
      </select>

      <select v-model="starsFilter" @change="handleFilterChange" class="filter-select">
        <option value="">所有星标</option>
        <option value=">100">100+ 星标</option>
        <option value=">500">500+ 星标</option>
        <option value=">1000">1000+ 星标</option>
        <option value=">5000">5000+ 星标</option>
        <option value=">10000">10000+ 星标</option>
      </select>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>搜索中...</p>
    </div>

    <!-- 搜索结果 -->
    <div v-else-if="results.length > 0" class="results-section">
      <p class="results-count">找到 {{ pagination.total.toLocaleString() }} 个仓库</p>

      <div class="results-list">
        <div
          v-for="repo in results"
          :key="repo.id"
          class="result-card"
          @click="viewRepository(repo)"
        >
          <div class="repo-header">
            <h3>{{ repo.full_name }}</h3>
            <span class="visibility-badge">{{ repo.private ? '私有' : '公开' }}</span>
          </div>

          <p class="repo-description">{{ repo.description || '暂无描述' }}</p>

          <div class="repo-meta">
            <span v-if="repo.language" class="meta-item">
              <span class="language-dot" :style="{ backgroundColor: getLanguageColor(repo.language) }"></span>
              {{ repo.language }}
            </span>
            <span class="meta-item">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"></path>
              </svg>
              {{ formatNumber(repo.stargazers_count) }}
            </span>
            <span class="meta-item">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75v-.878a2.25 2.25 0 111.5 0v.878a2.25 2.25 0 01-2.25 2.25h-1.5v2.128a2.251 2.251 0 11-1.5 0V8.5h-1.5A2.25 2.25 0 013.5 6.25v-.878a2.25 2.25 0 111.5 0zM5 3.25a.75.75 0 10-1.5 0 .75.75 0 001.5 0zm6.75.75a.75.75 0 100-1.5.75.75 0 000 1.5z"></path>
              </svg>
              {{ formatNumber(repo.forks_count) }}
            </span>
            <span class="meta-item updated">更新于 {{ formatDate(repo.updated_at) }}</span>
          </div>

          <div class="repo-actions">
            <button @click.stop="downloadRepository(repo)" class="btn-secondary">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M7.47 10.78a.75.75 0 001.06 0l3.75-3.75a.75.75 0 00-1.06-1.06L8.75 8.44V1.75a.75.75 0 00-1.5 0v6.69L4.78 5.97a.75.75 0 00-1.06 1.06l3.75 3.75zM3.75 13a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5z"></path>
              </svg>
              下载
            </button>
            <button @click.stop="forkRepository(repo)" class="btn-primary">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75v-.878a2.25 2.25 0 111.5 0v.878a2.25 2.25 0 01-2.25 2.25h-1.5v2.128a2.251 2.251 0 11-1.5 0V8.5h-1.5A2.25 2.25 0 013.5 6.25v-.878a2.25 2.25 0 111.5 0zM5 3.25a.75.75 0 10-1.5 0 .75.75 0 001.5 0zm6.75.75a.75.75 0 100-1.5.75.75 0 000 1.5z"></path>
              </svg>
              Fork
            </button>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div class="pagination">
        <button
          @click="prevPage"
          :disabled="pagination.page === 1"
          class="btn-secondary"
        >
          上一页
        </button>
        <span class="page-info">第 {{ pagination.page }} 页</span>
        <button
          @click="nextPage"
          :disabled="results.length < pagination.perPage"
          class="btn-secondary"
        >
          下一页
        </button>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="searchQuery && !loading" class="empty-state">
      <p>未找到相关仓库</p>
    </div>

    <!-- 初始状态 -->
    <div v-else class="initial-state">
      <svg viewBox="0 0 16 16" width="64" height="64" fill="#95a5a6">
        <path d="M10.68 11.74a6 6 0 01-7.922-8.984 6 6 0 018.984 7.922l3.04 3.04a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215l-3.04-3.04zm-5.354-1.275a4.5 4.5 0 106.364-6.364 4.5 4.5 0 01-6.364 6.364z"></path>
      </svg>
      <p>搜索 GitHub 上的开源项目</p>
    </div>

    <!-- 下载进度对话框 -->
    <div v-if="showDownloadDialog" class="dialog-overlay" @click="showDownloadDialog = false">
      <div class="dialog" @click.stop>
        <h2>下载项目</h2>
        <div class="download-info">
          <p><strong>{{ downloadRepo?.full_name }}</strong></p>
          <p class="download-path">{{ downloadPath }}</p>
        </div>

        <div v-if="downloading" class="progress-section">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: downloadProgress + '%' }"></div>
          </div>
          <p class="progress-text">{{ downloadProgress }}%</p>
        </div>

        <div class="form-actions">
          <button v-if="!downloading" @click="selectDownloadPath" class="btn-secondary">
            选择保存位置
          </button>
          <button
            v-if="!downloading && downloadPath"
            @click="startDownload"
            class="btn-primary"
          >
            开始下载
          </button>
          <button v-if="downloading" @click="cancelDownload" class="btn-danger">
            取消
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSearchStore } from '../stores/search'

const router = useRouter()
const searchStore = useSearchStore()

const searchQuery = ref('')
const languageFilter = ref('')
const sortFilter = ref('best-match')
const starsFilter = ref('')

const loading = computed(() => searchStore.loading)
const results = computed(() => searchStore.results)
const pagination = computed(() => searchStore.pagination)

const showDownloadDialog = ref(false)
const downloadRepo = ref(null)
const downloadPath = ref('')
const downloading = ref(false)
const downloadProgress = ref(0)

async function handleSearch() {
  if (!searchQuery.value.trim()) return

  searchStore.setFilters({
    language: languageFilter.value,
    sort: sortFilter.value,
    stars: starsFilter.value
  })

  await searchStore.searchRepositories(searchQuery.value)
}

function handleFilterChange() {
  if (searchQuery.value) {
    handleSearch()
  }
}

async function prevPage() {
  if (pagination.value.page > 1) {
    searchStore.pagination.page--
    await searchStore.searchRepositories()
  }
}

async function nextPage() {
  searchStore.pagination.page++
  await searchStore.searchRepositories()
}

function viewRepository(repo) {
  router.push(`/repository/${repo.owner.login}/${repo.name}`)
}

function downloadRepository(repo) {
  downloadRepo.value = repo
  downloadPath.value = ''
  downloadProgress.value = 0
  showDownloadDialog.value = true
}

async function selectDownloadPath() {
  const path = await window.electronAPI.fs.selectFolder()
  if (path) {
    downloadPath.value = path
  }
}

async function startDownload() {
  if (!downloadPath.value || !downloadRepo.value) return

  downloading.value = true
  downloadProgress.value = 0

  try {
    // 使用 git clone 或下载 zip
    const repo = downloadRepo.value
    const { exec } = require('child_process')
    const path = require('path')

    const targetPath = path.join(downloadPath.value, repo.name)

    // 模拟下载进度
    const progressInterval = setInterval(() => {
      if (downloadProgress.value < 90) {
        downloadProgress.value += 10
      }
    }, 500)

    // 使用 git clone
    await new Promise((resolve, reject) => {
      exec(`git clone ${repo.clone_url} "${targetPath}"`, (error) => {
        clearInterval(progressInterval)
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })

    downloadProgress.value = 100

    setTimeout(() => {
      showDownloadDialog.value = false
      alert('下载完成!')
    }, 500)
  } catch (error) {
    console.error('Download failed:', error)
    alert('下载失败: ' + error.message)
  } finally {
    downloading.value = false
  }
}

function cancelDownload() {
  downloading.value = false
  showDownloadDialog.value = false
}

async function forkRepository(repo) {
  if (!confirm(`确定要 Fork ${repo.full_name} 到你的账户吗?`)) return

  try {
    const result = await searchStore.forkRepository(repo.owner.login, repo.name)
    alert(`Fork 成功! 新仓库: ${result.full_name}`)
    router.push(`/repository/${result.owner.login}/${result.name}`)
  } catch (error) {
    alert('Fork 失败: ' + error.message)
  }
}

function formatNumber(num) {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k'
  }
  return num.toString()
}

function formatDate(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days} 天前`
  if (days < 30) return `${Math.floor(days / 7)} 周前`
  if (days < 365) return `${Math.floor(days / 30)} 月前`
  return `${Math.floor(days / 365)} 年前`
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
.search-page {
  max-width: 1200px;
  margin: 0 auto;
}

.search-header {
  margin-bottom: 32px;
}

.search-header h1 {
  font-size: 32px;
  font-weight: 600;
  color: var(--text-color);
}

.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.search-input {
  flex: 1;
  padding: 14px 20px;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  font-size: 16px;
  background: var(--card-bg);
  color: var(--text-color);
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.filters {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.filter-select {
  padding: 10px 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  background: var(--card-bg);
  color: var(--text-color);
  cursor: pointer;
  min-width: 140px;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
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

.results-section {
  margin-top: 24px;
}

.results-count {
  font-size: 14px;
  color: #7f8c8d;
  margin-bottom: 20px;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.result-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.repo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.repo-header h3 {
  font-size: 18px;
  color: var(--primary-color);
}

.visibility-badge {
  padding: 4px 10px;
  background: #e8f5e9;
  color: #2e7d32;
  border-radius: 12px;
  font-size: 12px;
}

.repo-description {
  color: #7f8c8d;
  font-size: 14px;
  margin-bottom: 12px;
}

.repo-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #95a5a6;
  margin-bottom: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.language-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.repo-actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 32px;
}

.page-info {
  font-size: 14px;
  color: #7f8c8d;
}

.empty-state {
  text-align: center;
  padding: 80px 0;
  color: #7f8c8d;
}

.initial-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: #95a5a6;
}

.initial-state p {
  margin-top: 16px;
  font-size: 16px;
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
  max-width: 480px;
}

.dialog h2 {
  font-size: 24px;
  color: var(--text-color);
  margin-bottom: 20px;
}

.download-info {
  margin-bottom: 24px;
}

.download-info p {
  margin-bottom: 8px;
}

.download-path {
  font-size: 14px;
  color: #7f8c8d;
  word-break: break-all;
}

.progress-section {
  margin-bottom: 24px;
}

.progress-bar {
  height: 8px;
  background: var(--border-color);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color);
  transition: width 0.3s;
}

.progress-text {
  text-align: center;
  font-size: 14px;
  color: var(--text-color);
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
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s;
}

.btn-secondary:hover:not(:disabled) {
  background: var(--border-color);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger {
  padding: 10px 20px;
  background: #c33;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-danger:hover {
  opacity: 0.9;
}
</style>
