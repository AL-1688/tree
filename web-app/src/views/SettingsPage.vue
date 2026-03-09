<template>
  <div class="settings-page">
    <el-card>
      <template #header>
        <span>设置</span>
      </template>

      <el-form label-width="120px">
        <!-- 用户信息 -->
        <el-form-item label="当前用户">
          <div class="user-info" v-if="authStore.user">
            <el-avatar :size="50" :src="authStore.user.avatar_url" />
            <div class="user-detail">
              <div class="username">{{ authStore.user.login }}</div>
              <div class="bio">{{ authStore.user.bio || '暂无简介' }}</div>
            </div>
          </div>
        </el-form-item>

        <el-divider />

        <!-- Token 管理 -->
        <el-form-item label="Access Token">
          <el-input
            v-model="tokenDisplay"
            disabled
            style="width: 400px"
          />
          <el-button type="primary" @click="showTokenDialog = true" style="margin-left: 10px">
            更换 Token
          </el-button>
        </el-form-item>

        <el-divider />

        <!-- 缓存管理 -->
        <el-form-item label="本地缓存">
          <el-button @click="clearCache">清除缓存</el-button>
          <span class="cache-info">清除后需要重新登录</span>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 更换 Token 对话框 -->
    <el-dialog v-model="showTokenDialog" title="更换 Access Token" width="500px">
      <el-form :model="tokenForm" :rules="tokenRules" ref="tokenFormRef" label-width="100px">
        <el-form-item label="新 Token" prop="token">
          <el-input
            v-model="tokenForm.token"
            type="password"
            placeholder="请输入新的 Personal Access Token"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showTokenDialog = false">取消</el-button>
        <el-button type="primary" @click="handleUpdateToken" :loading="updating">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const showTokenDialog = ref(false)
const tokenFormRef = ref(null)
const updating = ref(false)

const tokenForm = reactive({
  token: ''
})

const tokenRules = {
  token: [
    { required: true, message: '请输入 Token', trigger: 'blur' },
    { min: 40, message: 'Token 长度不正确', trigger: 'blur' }
  ]
}

const tokenDisplay = computed(() => {
  // 安全考虑：不显示任何 token 信息
  return authStore.token ? '••••••••••••••••' : ''
})

async function handleUpdateToken() {
  if (!tokenFormRef.value) return

  await tokenFormRef.value.validate(async (valid) => {
    if (!valid) return

    updating.value = true
    try {
      const result = await authStore.login(tokenForm.token)
      if (result.success) {
        ElMessage.success('Token 更新成功')
        showTokenDialog.value = false
        tokenForm.token = ''
      } else {
        ElMessage.error(result.error || 'Token 验证失败')
      }
    } catch (error) {
      ElMessage.error(error.message || 'Token 验证失败')
    } finally {
      updating.value = false
    }
  })
}

function clearCache() {
  authStore.logout()
  localStorage.clear()
  ElMessage.success('缓存已清除')
  router.push('/login')
}
</script>

<style scoped>
.settings-page {
  max-width: 800px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.user-detail {
  display: flex;
  flex-direction: column;
}

.username {
  font-size: 16px;
  font-weight: 500;
}

.bio {
  color: #909399;
  font-size: 14px;
}

.cache-info {
  margin-left: 15px;
  color: #909399;
  font-size: 13px;
}
</style>
