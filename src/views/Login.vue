<template>
  <div class="login-page">
    <div class="login-card">
      <div class="logo">
        <svg height="80" viewBox="0 0 16 16" width="80" fill="white">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
        </svg>
      </div>
      <h1>GitHub Client</h1>
      <p class="subtitle">管理你的 GitHub 仓库</p>

      <div v-if="!showConfig" class="login-actions">
        <button @click="handleLogin" class="btn-primary" :disabled="loading">
          {{ loading ? '登录中...' : '登录 GitHub' }}
        </button>
        <button @click="showConfig = true" class="btn-secondary">
          配置 OAuth
        </button>
      </div>

      <div v-else class="config-form">
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
        <div class="form-actions">
          <button @click="saveConfig" class="btn-primary">保存配置</button>
          <button @click="showConfig = false" class="btn-secondary">取消</button>
        </div>
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const loading = ref(false)
const showConfig = ref(false)
const error = ref('')
const oauthConfig = ref({
  clientId: '',
  clientSecret: ''
})

async function handleLogin() {
  loading.value = true
  error.value = ''

  try {
    const result = await authStore.login()
    if (!result.success) {
      error.value = result.error || '登录失败,请重试'
    }
  } catch (err) {
    error.value = err.message || '登录失败,请检查网络连接'
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  if (!oauthConfig.value.clientId || !oauthConfig.value.clientSecret) {
    error.value = '请填写完整的 OAuth 配置'
    return
  }

  try {
    await window.electronAPI.storage.set('oauth_config', oauthConfig.value)
    showConfig.value = false
    error.value = ''
    // 自动登录
    await handleLogin()
  } catch (err) {
    error.value = '保存配置失败'
  }
}
</script>

<style scoped>
.login-page {
  width: 100%;
  max-width: 400px;
}

.login-card {
  background: white;
  border-radius: 12px;
  padding: 48px 40px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
}

.logo {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

h1 {
  font-size: 28px;
  font-weight: 600;
  text-align: center;
  color: #2c3e50;
  margin-bottom: 8px;
}

.subtitle {
  text-align: center;
  color: #7f8c8d;
  margin-bottom: 32px;
  font-size: 15px;
}

.login-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.btn-primary {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  width: 100%;
  padding: 14px;
  background: transparent;
  color: #667eea;
  border: 2px solid #667eea;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.btn-secondary:hover {
  background: #667eea;
  color: white;
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: #2c3e50;
}

.form-group input {
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 15px;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.form-actions button {
  flex: 1;
}

.error-message {
  margin-top: 16px;
  padding: 12px;
  background: #fee;
  border: 1px solid #fcc;
  border-radius: 8px;
  color: #c33;
  font-size: 14px;
  text-align: center;
}
</style>
