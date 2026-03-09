<template>
  <el-container class="layout-container">
    <!-- 侧边栏 -->
    <el-aside width="220px" class="sidebar">
      <div class="logo">
        <el-icon size="24"><Box /></el-icon>
        <span>GitHub Client</span>
      </div>

      <el-menu
        :default-active="activeMenu"
        router
        class="sidebar-menu"
      >
        <el-menu-item index="/repositories">
          <el-icon><Folder /></el-icon>
          <span>我的仓库</span>
        </el-menu-item>
        <el-menu-item index="/upload">
          <el-icon><Upload /></el-icon>
          <span>文件上传</span>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>设置</span>
        </el-menu-item>
      </el-menu>

      <!-- 用户信息 -->
      <div class="user-info" v-if="authStore.user">
        <el-avatar :size="40" :src="authStore.user.avatar_url" />
        <div class="user-detail">
          <span class="username">{{ authStore.user.login }}</span>
          <el-button type="text" size="small" @click="handleLogout">退出</el-button>
        </div>
      </div>
    </el-aside>

    <!-- 主内容区 -->
    <el-container>
      <el-header class="header">
        <span class="page-title">{{ pageTitle }}</span>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const activeMenu = computed(() => {
  const path = route.path
  if (path.startsWith('/repository/')) {
    return '/repositories'
  }
  return path
})

const pageTitle = computed(() => {
  return route.meta.title || 'GitHub Client'
})

function handleLogout() {
  ElMessageBox.confirm('确定要退出登录吗?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    authStore.logout()
    ElMessage.success('已退出登录')
    router.push('/login')
  }).catch(() => {})
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.sidebar {
  background-color: #304156;
  display: flex;
  flex-direction: column;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  border-bottom: 1px solid #3a4a5c;
}

.sidebar-menu {
  flex: 1;
  border-right: none;
  background-color: #304156;
}

.sidebar-menu :deep(.el-menu-item) {
  color: #bfcbd9;
}

.sidebar-menu :deep(.el-menu-item:hover),
.sidebar-menu :deep(.el-menu-item.is-active) {
  background-color: #263445;
  color: #409eff;
}

.user-info {
  padding: 15px;
  border-top: 1px solid #3a4a5c;
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.username {
  color: #fff;
  font-size: 14px;
}

.header {
  background-color: #fff;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  align-items: center;
  padding: 0 20px;
}

.page-title {
  font-size: 18px;
  font-weight: 500;
}

.main {
  background-color: #f5f7fa;
  padding: 20px;
}
</style>
