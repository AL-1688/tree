<template>
  <div class="settings-page">
    <header class="settings-header">
      <h1>设置</h1>
    </header>

    <div class="settings-content">
      <!-- 主题设置 -->
      <div class="settings-section">
        <h2>外观</h2>
        <div class="setting-item">
          <div class="setting-info">
            <h3>主题</h3>
            <p>选择应用的主题外观</p>
          </div>
          <div class="setting-control">
            <select v-model="theme" @change="updateTheme" class="theme-select">
              <option value="light">浅色模式</option>
              <option value="dark">深色模式</option>
            </select>
          </div>
        </div>
      </div>

      <!-- OAuth 配置 -->
      <div class="settings-section">
        <h2>GitHub OAuth 配置</h2>
        <p class="section-desc">
          需要先注册 GitHub OAuth App 才能使用登录功能。
          <a href="#" @click.prevent="openOAuthGuide">了解如何注册</a>
        </p>

        <div class="form-group">
          <label>Client ID</label>
          <input
            v-model="oauthConfig.clientId"
            type="text"
            placeholder="输入 GitHub OAuth App Client ID"
          />
        </div>

        <div class="form-group">
          <label>Client Secret</label>
          <input
            v-model="oauthConfig.clientSecret"
            type="password"
            placeholder="输入 GitHub OAuth App Client Secret"
          />
        </div>

        <button @click="saveOAuthConfig" class="btn-primary">
          保存配置
        </button>
      </div>

      <!-- 缓存管理 -->
      <div class="settings-section">
        <h2>缓存管理</h2>
        <p class="section-desc">
          管理离线缓存数据，提高应用响应速度。
        </p>

        <div class="cache-stats" v-if="cacheStats">
          <div class="stat-item">
            <span class="stat-label">缓存条目</span>
            <span class="stat-value">{{ cacheStats.count }} 个</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">缓存大小</span>
            <span class="stat-value">{{ formatSize(cacheStats.totalSize) }}</span>
          </div>
        </div>

        <div class="cache-actions">
          <button @click="refreshCacheStats" class="btn-secondary" :disabled="cacheLoading">
            {{ cacheLoading ? '加载中...' : '刷新统计' }}
          </button>
          <button @click="cleanupCache" class="btn-secondary" :disabled="cacheLoading">
            清理过期缓存
          </button>
          <button @click="clearAllCache" class="btn-danger" :disabled="cacheLoading">
            清空所有缓存
          </button>
        </div>
      </div>

      <!-- 上传设置 -->
      <div class="settings-section">
        <h2>上传设置</h2>

        <div class="setting-item">
          <div class="setting-info">
            <h3>默认分支</h3>
            <p>上传文件时使用的默认分支名称</p>
          </div>
          <div class="setting-control">
            <input v-model="defaultBranch" type="text" placeholder="main" />
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <h3>最大并发数</h3>
            <p>同时上传的文件数量上限</p>
          </div>
          <div class="setting-control">
            <input v-model.number="maxConcurrency" type="number" min="1" max="10" />
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <h3>大文件阈值</h3>
            <p>超过此大小将启用分块上传（MB）</p>
          </div>
          <div class="setting-control">
            <input v-model.number="chunkThreshold" type="number" min="1" max="100" />
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <h3>分块大小</h3>
            <p>大文件上传时的分块大小（KB）</p>
          </div>
          <div class="setting-control">
            <input v-model.number="chunkSize" type="number" min="64" max="1024" />
          </div>
        </div>

        <button @click="saveUploadSettings" class="btn-primary">
          保存设置
        </button>
      </div>

      <!-- 账户信息 -->
      <div class="settings-section">
        <h2>账户信息</h2>
        <div v-if="authStore.user" class="user-info">
          <img :src="authStore.user.avatar_url" :alt="authStore.user.login" class="avatar" />
          <div class="user-details">
            <div class="username">{{ authStore.user.login }}</div>
            <div class="user-name">{{ authStore.user.name }}</div>
            <div class="user-email">{{ authStore.user.email }}</div>
          </div>
          <button @click="handleLogout" class="btn-secondary">
            退出登录
          </button>
        </div>
      </div>

      <!-- 关于 -->
      <div class="settings-section">
        <h2>关于</h2>
        <div class="about-info">
          <p><strong>GitHub Client</strong> v1.0.0</p>
          <p>一个基于 Electron + Vue 3 构建的 GitHub 客户端管理工具</p>
          <p class="copyright">Created with Claude Code</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useSettingsStore } from '../stores/settings'
import { getCacheStats, cleanupCache as cleanupExpiredCache, clearCache } from '../utils/cache'

const authStore = useAuthStore()
const settingsStore = useSettingsStore()

const theme = ref('light')
const oauthConfig = ref({
  clientId: '',
  clientSecret: ''
})
const defaultBranch = ref('main')
const maxConcurrency = ref(5)
const chunkThreshold = ref(5)
const chunkSize = ref(256)
const cacheStats = ref(null)
const cacheLoading = ref(false)

onMounted(async () => {
  theme.value = settingsStore.theme
  defaultBranch.value = settingsStore.defaultBranch
  maxConcurrency.value = settingsStore.maxConcurrency

  // 加载已保存的 OAuth 配置
  const savedConfig = await window.electronAPI.storage.get('oauth_config')
  if (savedConfig) {
    oauthConfig.value = savedConfig
  }

  // 加载上传设置
  const uploadSettings = await window.electronAPI.storage.get('upload_settings')
  if (uploadSettings) {
    chunkThreshold.value = uploadSettings.chunkThreshold || 5
    chunkSize.value = uploadSettings.chunkSize || 256
  }

  // 加载缓存统计
  await refreshCacheStats()
})

async function updateTheme() {
  await settingsStore.setTheme(theme.value)
}

async function saveOAuthConfig() {
  try {
    await window.electronAPI.storage.set('oauth_config', oauthConfig.value)
    alert('OAuth 配置已保存')
  } catch (error) {
    alert('保存失败: ' + error.message)
  }
}

async function saveUploadSettings() {
  try {
    await settingsStore.setDefaultBranch(defaultBranch.value)
    await settingsStore.setMaxConcurrency(maxConcurrency.value)
    await window.electronAPI.storage.set('upload_settings', {
      chunkThreshold: chunkThreshold.value,
      chunkSize: chunkSize.value
    })
    alert('上传设置已保存')
  } catch (error) {
    alert('保存失败: ' + error.message)
  }
}

function openOAuthGuide() {
  window.electronAPI.shell?.openExternal?.('https://docs.github.com/en/developers/apps/building-oauth-apps/creating-an-oauth-app')
}

async function handleLogout() {
  if (confirm('确定要退出登录吗?')) {
    await authStore.logout()
  }
}

async function refreshCacheStats() {
  cacheLoading.value = true
  try {
    cacheStats.value = await getCacheStats()
  } catch (error) {
    console.error('Failed to get cache stats:', error)
  } finally {
    cacheLoading.value = false
  }
}

async function cleanupCache() {
  if (!confirm('确定要清理过期缓存吗?')) return

  cacheLoading.value = true
  try {
    const result = await cleanupExpiredCache()
    alert(`已清理 ${result.removed} 个过期缓存`)
    await refreshCacheStats()
  } catch (error) {
    alert('清理失败: ' + error.message)
  } finally {
    cacheLoading.value = false
  }
}

async function clearAllCache() {
  if (!confirm('确定要清空所有缓存吗? 这将删除所有离线数据。')) return

  cacheLoading.value = true
  try {
    await clearCache()
    alert('缓存已清空')
    await refreshCacheStats()
  } catch (error) {
    alert('清空失败: ' + error.message)
  } finally {
    cacheLoading.value = false
  }
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<style scoped>
.settings-page {
  max-width: 800px;
  margin: 0 auto;
}

.settings-header {
  margin-bottom: 32px;
}

.settings-header h1 {
  font-size: 32px;
  font-weight: 600;
  color: var(--text-color);
}

.settings-section {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}

.settings-section h2 {
  font-size: 20px;
  color: var(--text-color);
  margin-bottom: 16px;
}

.section-desc {
  font-size: 14px;
  color: #7f8c8d;
  margin-bottom: 20px;
}

.section-desc a {
  color: var(--primary-color);
  text-decoration: none;
}

.section-desc a:hover {
  text-decoration: underline;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-color);
}

.setting-item:last-of-type {
  border-bottom: none;
  margin-bottom: 20px;
}

.setting-info h3 {
  font-size: 16px;
  color: var(--text-color);
  margin-bottom: 4px;
}

.setting-info p {
  font-size: 14px;
  color: #7f8c8d;
}

.setting-control {
  min-width: 200px;
}

.theme-select,
.setting-control input[type="text"],
.setting-control input[type="number"] {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  background: var(--card-bg);
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

.form-group input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 15px;
  background: var(--card-bg);
  color: var(--text-color);
}

.form-group input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
}

.user-details {
  flex: 1;
}

.username {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 4px;
}

.user-name {
  font-size: 14px;
  color: #7f8c8d;
  margin-bottom: 2px;
}

.user-email {
  font-size: 13px;
  color: #95a5a6;
}

.about-info {
  font-size: 14px;
  color: var(--text-color);
  line-height: 1.8;
}

.copyright {
  margin-top: 8px;
  color: #95a5a6;
  font-size: 13px;
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

.btn-danger {
  padding: 10px 20px;
  background: #dc3545;
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

.btn-danger:disabled,
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cache-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(102, 126, 234, 0.05);
  border-radius: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 13px;
  color: #7f8c8d;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
}

.cache-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
