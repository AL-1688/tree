<template>
  <div class="dashboard">
    <header class="dashboard-header">
      <h1>我的仓库</h1>
      <div class="actions">
        <button @click="showCreateDialog = true" class="btn-primary">
          创建仓库
        </button>
      </div>
    </header>

    <div class="filters">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索仓库..."
        class="search-input"
      />
      <select v-model="filterType" class="filter-select">
        <option value="all">全部</option>
        <option value="public">公开</option>
        <option value="private">私有</option>
        <option value="owner">归属</option>
      </select>
      <select v-model="sortBy" class="filter-select">
        <option value="updated">最近更新</option>
        <option value="created">创建时间</option>
        <option value="full_name">名称</option>
        <option value="pushed">最近推送</option>
      </select>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="filteredRepos.length === 0" class="empty-state">
      <p>没有找到仓库</p>
    </div>

    <div v-else class="repo-grid">
      <div
        v-for="repo in filteredRepos"
        :key="repo.id"
        class="repo-card"
        @click="goToRepo(repo)"
      >
        <div class="repo-header">
          <h3>{{ repo.name }}</h3>
          <span :class="['visibility-badge', repo.private ? 'private' : 'public']">
            {{ repo.private ? '私有' : '公开' }}
          </span>
        </div>
        <p class="repo-description">{{ repo.description || '暂无描述' }}</p>
        <div class="repo-footer">
          <span v-if="repo.language" class="language">
            <span class="language-dot" :style="{ backgroundColor: getLanguageColor(repo.language) }"></span>
            {{ repo.language }}
          </span>
          <span class="updated">更新于 {{ formatDate(repo.updated_at) }}</span>
        </div>
      </div>
    </div>

    <!-- 创建仓库对话框 -->
    <div v-if="showCreateDialog" class="dialog-overlay" @click="showCreateDialog = false">
      <div class="dialog" @click.stop>
        <h2>创建新仓库</h2>
        <form @submit.prevent="createRepo">
          <div class="form-group">
            <label>仓库名称 *</label>
            <input v-model="newRepo.name" type="text" required placeholder="输入仓库名称" />
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="newRepo.description" placeholder="输入仓库描述(可选)"></textarea>
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input v-model="newRepo.private" type="checkbox" />
              <span>私有仓库</span>
            </label>
          </div>
          <div class="form-actions">
            <button type="button" @click="showCreateDialog = false" class="btn-secondary">取消</button>
            <button type="submit" class="btn-primary">创建</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useRepositoryStore } from '../stores/repository'

const router = useRouter()
const repoStore = useRepositoryStore()

const loading = computed(() => repoStore.loading)
const searchQuery = ref('')
const filterType = ref('all')
const sortBy = ref('updated')
const showCreateDialog = ref(false)
const newRepo = ref({
  name: '',
  description: '',
  private: false
})

const filteredRepos = computed(() => {
  let result = repoStore.repositories

  // 搜索
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(repo =>
      repo.name.toLowerCase().includes(query) ||
      (repo.description && repo.description.toLowerCase().includes(query))
    )
  }

  // 类型过滤
  if (filterType.value === 'public') {
    result = result.filter(repo => !repo.private)
  } else if (filterType.value === 'private') {
    result = result.filter(repo => repo.private)
  }

  // 排序
  result = [...result].sort((a, b) => {
    if (sortBy.value === 'full_name') {
      return a.full_name.localeCompare(b.full_name)
    }
    return new Date(b[sortBy.value]) - new Date(a[sortBy.value])
  })

  return result
})

onMounted(() => {
  repoStore.fetchRepositories()
})

watch([filterType, sortBy], () => {
  repoStore.setFilters({
    type: filterType.value,
    sort: sortBy.value
  })
})

function goToRepo(repo) {
  router.push(`/repository/${repo.owner.login}/${repo.name}`)
}

async function createRepo() {
  try {
    const repo = await repoStore.createRepository(newRepo.value)
    showCreateDialog.value = false
    newRepo.value = { name: '', description: '', private: false }
    router.push(`/repository/${repo.owner.login}/${repo.name}`)
  } catch (error) {
    alert('创建仓库失败: ' + error.message)
  }
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
    CSS: '#563d7c',
    Shell: '#89e051',
    Dockerfile: '#384d54'
  }
  return colors[language] || '#8e8e8e'
}
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.dashboard-header h1 {
  font-size: 32px;
  font-weight: 600;
  color: var(--text-color);
}

.filters {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.search-input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  font-size: 15px;
  background: var(--card-bg);
  color: var(--text-color);
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.filter-select {
  padding: 12px 16px;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  font-size: 15px;
  background: var(--card-bg);
  color: var(--text-color);
  cursor: pointer;
  min-width: 140px;
}

.loading {
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

.empty-state {
  text-align: center;
  padding: 80px 0;
  color: #7f8c8d;
}

.repo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
}

.repo-card {
  background: var(--card-bg);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  padding: 24px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.repo-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.repo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.repo-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--primary-color);
}

.visibility-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
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

.repo-description {
  color: #7f8c8d;
  font-size: 14px;
  margin-bottom: 16px;
  line-height: 1.5;
}

.repo-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #95a5a6;
}

.language {
  display: flex;
  align-items: center;
  gap: 6px;
}

.language-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
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
  max-height: 90vh;
  overflow-y: auto;
}

.dialog h2 {
  font-size: 24px;
  margin-bottom: 24px;
  color: var(--text-color);
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
  margin-bottom: 8px;
}

.form-group input[type="text"],
.form-group textarea {
  width: 100%;
  padding: 12px;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  font-size: 15px;
  background: var(--card-bg);
  color: var(--text-color);
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.form-actions button {
  flex: 1;
}

.btn-primary {
  padding: 12px 24px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  padding: 12px 24px;
  background: transparent;
  color: var(--text-color);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: var(--border-color);
}
</style>
