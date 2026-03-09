<template>
  <div class="login-page">
    <el-card class="login-card">
      <template #header>
        <div class="card-header">
          <span class="title">GitHub Client</span>
          <span class="subtitle">浏览器版本</span>
        </div>
      </template>

      <el-form :model="form" :rules="rules" ref="formRef" label-position="top">
        <el-form-item label="Personal Access Token" prop="token">
          <el-input
            v-model="form.token"
            type="password"
            placeholder="请输入 GitHub Personal Access Token"
            show-password
            :disabled="loading"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            @click="handleLogin"
            :loading="loading"
            style="width: 100%"
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>

      <el-divider />

      <div class="help-section">
        <p class="help-title">如何获取 Token?</p>
        <ol class="help-steps">
          <li>访问 GitHub Settings -> Developer settings -> Personal access tokens</li>
          <li>点击 "Generate new token (classic)"</li>
          <li>选择需要的权限：repo, user</li>
          <li>生成并复制 Token</li>
        </ol>
        <el-link
          type="primary"
          href="https://github.com/settings/tokens"
          target="_blank"
        >
          前往生成 Token
        </el-link>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const formRef = ref(null)
const loading = ref(false)

const form = reactive({
  token: ''
})

const rules = {
  token: [
    { required: true, message: '请输入 Token', trigger: 'blur' },
    { min: 40, message: 'Token 长度不正确', trigger: 'blur' }
  ]
}

async function handleLogin() {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    loading.value = true
    try {
      const result = await authStore.login(form.token)
      if (result.success) {
        ElMessage.success('登录成功')
        router.push('/')
      } else {
        ElMessage.error(result.error || '登录失败')
      }
    } catch (error) {
      ElMessage.error(error.message || '登录失败')
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped>
.login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  width: 420px;
}

.card-header {
  text-align: center;
}

.title {
  font-size: 24px;
  font-weight: bold;
  display: block;
}

.subtitle {
  font-size: 14px;
  color: #909399;
}

.help-section {
  font-size: 13px;
  color: #606266;
}

.help-title {
  font-weight: bold;
  margin-bottom: 8px;
}

.help-steps {
  padding-left: 20px;
  margin-bottom: 12px;
}

.help-steps li {
  margin-bottom: 4px;
}
</style>
