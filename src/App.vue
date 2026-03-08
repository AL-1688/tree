<template>
  <div id="app" :class="theme">
    <div v-if="!isAuthenticated" class="login-container">
      <Login />
    </div>
    <div v-else class="app-container">
      <Sidebar />
      <main class="main-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import { useSettingsStore } from './stores/settings'
import Login from './views/Login.vue'
import Sidebar from './components/Common/Sidebar.vue'

const authStore = useAuthStore()
const settingsStore = useSettingsStore()

const isAuthenticated = computed(() => authStore.isAuthenticated)
const theme = computed(() => settingsStore.theme)

// 初始化应用
onMounted(async () => {
  try {
    // 初始化设置
    await settingsStore.init()
    // 初始化认证状态
    await authStore.init()
  } catch (error) {
    console.error('App initialization error:', error)
  }
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  height: 100vh;
  overflow: hidden;
}

.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.app-container {
  display: flex;
  height: 100vh;
  background-color: var(--bg-color);
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

/* 主题变量 */
#app.light {
  --bg-color: #f5f7fa;
  --text-color: #2c3e50;
  --border-color: #dcdfe6;
  --primary-color: #409eff;
  --sidebar-bg: #ffffff;
  --card-bg: #ffffff;
}

#app.dark {
  --bg-color: #1a1a2e;
  --text-color: #e0e0e0;
  --border-color: #383f5d;
  --primary-color: #667eea;
  --sidebar-bg: #16213e;
  --card-bg: #1f2937;
}
</style>
