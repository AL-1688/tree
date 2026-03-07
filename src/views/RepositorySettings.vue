<template>
  <div class="repository-settings">
    <header class="settings-header">
      <button @click="$router.back()" class="back-btn">
        <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
          <path d="M7.78 12.53a.75.75 0 01-1.06 0L2.47 8.28a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 1.06L4.81 7h7.44a.75.75 0 010 1.5H4.81l2.97 2.97a.75.75 0 010 1.06z"></path>
        </svg>
      </button>
      <h1>仓库设置</h1>
    </header>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <div v-else class="settings-content">
      <div class="settings-section">
        <h2>基本信息</h2>
        <form @submit.prevent="saveSettings">
          <div class="form-group">
            <label>仓库名称</label>
            <input v-model="form.name" type="text" required />
          </div>

          <div class="form-group">
            <label>描述</label>
            <textarea v-model="form.description" rows="3" placeholder="简短描述你的仓库"></textarea>
          </div>

          <div class="form-group">
            <label>网站 URL</label>
            <input v-model="form.homepage" type="url" placeholder="https://example.com" />
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input v-model="form.private" type="checkbox" />
              <span>私有仓库</span>
            </label>
            <p class="help-text">私有仓库仅对你和协作者可见</p>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-primary" :disabled="saving">
              {{ saving ? '保存中...' : '保存更改' }}
            </button>
          </div>
        </form>
      </div>

      <div class="settings-section danger-zone">
        <h2>危险区域</h2>
        <div class="danger-item">
          <div class="danger-info">
            <h3>删除此仓库</h3>
            <p>删除后将无法恢复。请谨慎操作。</p>
          </div>
          <button @click="confirmDelete" class="btn-danger">删除仓库</button>
        </div>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <div v-if="showDeleteDialog" class="dialog-overlay" @click="showDeleteDialog = false">
      <div class="dialog" @click.stop>
        <h2>确认删除仓库</h2>
        <p class="warning-text">此操作不可逆,请输入仓库名称 <strong>{{ repository?.full_name }}</strong> 以确认删除:</p>
        <input
          v-model="confirmRepoName"
          type="text"
          :placeholder="repository?.full_name"
          class="confirm-input"
        />
        <div class="form-actions">
          <button @click="showDeleteDialog = false" class="btn-secondary">取消</button>
          <button
            @click="deleteRepository"
            class="btn-danger"
            :disabled="confirmRepoName !== repository?.full_name || deleting"
          >
            {{ deleting ? '删除中...' : '确认删除' }}
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

const form = ref({
  name: '',
  description: '',
  homepage: '',
  private: false
})

const saving = ref(false)
const showDeleteDialog = ref(false)
const confirmRepoName = ref('')
const deleting = ref(false)

onMounted(async () => {
  const { owner, repo } = route.params
  const data = await repoStore.fetchRepository(owner, repo)

  form.value = {
    name: data.name,
    description: data.description || '',
    homepage: data.homepage || '',
    private: data.private
  }
})

async function saveSettings() {
  saving.value = true
  try {
    const { owner, repo } = route.params
    await repoStore.updateRepository(owner, repo, form.value)
    alert('设置已保存')
  } catch (error) {
    alert('保存失败: ' + error.message)
  } finally {
    saving.value = false
  }
}

function confirmDelete() {
  showDeleteDialog.value = true
  confirmRepoName.value = ''
}

async function deleteRepository() {
  deleting.value = true
  try {
    const { owner, repo } = route.params
    await repoStore.deleteRepository(owner, repo)
    router.push('/dashboard')
  } catch (error) {
    alert('删除失败: ' + error.message)
  } finally {
    deleting.value = false
    showDeleteDialog.value = false
  }
}
</script>

<style scoped>
.repository-settings {
  max-width: 800px;
  margin: 0 auto;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
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

.settings-header h1 {
  font-size: 28px;
  font-weight: 600;
  color: var(--text-color);
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
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
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
.form-group input[type="url"],
.form-group textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 15px;
  background: var(--card-bg);
  color: var(--text-color);
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary-color);
}

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.help-text {
  font-size: 13px;
  color: #7f8c8d;
  margin-top: 6px;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

/* 危险区域 */
.danger-zone {
  border-color: #fcc;
}

.danger-zone h2 {
  color: #c33;
  border-bottom-color: #fcc;
}

.danger-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #fee;
  border-radius: 8px;
}

.danger-info h3 {
  font-size: 16px;
  color: #c33;
  margin-bottom: 4px;
}

.danger-info p {
  font-size: 14px;
  color: #7f8c8d;
}

/* 对话框 */
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
  margin-bottom: 16px;
}

.warning-text {
  font-size: 15px;
  color: var(--text-color);
  margin-bottom: 20px;
  line-height: 1.6;
}

.confirm-input {
  width: 100%;
  padding: 12px;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  font-size: 15px;
  background: var(--card-bg);
  color: var(--text-color);
  margin-bottom: 20px;
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
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: var(--border-color);
}

.btn-danger {
  padding: 10px 20px;
  background: #c33;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-danger:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
