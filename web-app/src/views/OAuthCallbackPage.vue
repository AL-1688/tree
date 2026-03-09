<template>
  <div class="callback-page">
    <el-card class="callback-card">
      <div class="loading" v-if="loading">
        <el-icon class="is-loading" :size="48"><Loading /></el-icon>
        <p>正在完成登录...</p>
      </div>
      <div class="error" v-else-if="error">
        <el-icon :size="48" color="#f56c6c"><CircleClose /></el-icon>
        <p>{{ error }}</p>
        <el-button type="primary" @click="goToLogin">返回登录</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  const sessionId = route.query.sessionId

  if (!sessionId) {
    error.value = '无效的登录会话'
    loading.value = false
    return
  }

  try {
    const result = await authStore.fetchToken(sessionId)
    if (result.success) {
      ElMessage.success('登录成功')
      router.push('/')
    } else {
      error.value = result.error || '登录失败'
    }
  } catch (e) {
    error.value = e.message || '登录失败'
  } finally {
    loading.value = false
  }
})

function goToLogin() {
  router.push('/login')
}
</script>

<style scoped>
.callback-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.callback-card {
  width: 400px;
  text-align: center;
  padding: 20px;
}

.loading, .error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.loading p, .error p {
  font-size: 16px;
  color: #606266;
}
</style>
