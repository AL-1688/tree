<template>
  <aside class="sidebar">
    <div class="user-info" v-if="authStore.user">
      <img :src="authStore.user.avatar_url" :alt="authStore.user.login" class="avatar" />
      <div class="user-details">
        <div class="username">{{ authStore.user.login }}</div>
        <div class="user-name">{{ authStore.user.name }}</div>
      </div>
    </div>

    <nav class="nav-menu">
      <router-link to="/dashboard" class="nav-item" active-class="active">
        <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
          <path d="M0 1.75A.75.75 0 01.75 1h4.253c1.227 0 2.317.59 3 1.501A3.743 3.743 0 0111.006 1h4.245a.75.75 0 01.75.75v10.5a.75.75 0 01-.75.75h-4.507a2.25 2.25 0 00-1.591.659l-.622.621a.75.75 0 01-1.06 0l-.622-.621A2.25 2.25 0 005.258 13H.75a.75.75 0 01-.75-.75V1.75zm7.251 10.324l.004-5.073-.002-2.253A2.25 2.25 0 005.003 2.5H1.5v9h3.757a3.75 3.75 0 011.994.574zM8.755 4.75l-.004 7.322a3.752 3.752 0 011.992-.572H14.5v-9h-3.495a2.25 2.25 0 00-2.25 2.25z"></path>
        </svg>
        <span>仓库列表</span>
      </router-link>

      <router-link to="/settings" class="nav-item" active-class="active">
        <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
          <path d="M8 0a8 8 0 100 16A8 8 0 008 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0zm7.25-3.25a.75.75 0 00-1.5 0v3.5c0 .199.079.39.22.53l2 2a.75.75 0 101.06-1.06l-1.78-1.78V4.75z"></path>
        </svg>
        <span>设置</span>
      </router-link>
    </nav>

    <div class="sidebar-footer">
      <button @click="toggleTheme" class="theme-toggle">
        <svg v-if="settingsStore.theme === 'light'" viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
          <path d="M9.598 1.591a.749.749 0 01.785-.175 7.001 7.001 0 109.867 9.867.75.75 0 01-.961.96 5.5 5.5 0 11-7.046-7.046.749.749 0 01.255-.606z"></path>
        </svg>
        <svg v-else viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
          <path d="M8 10.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM8 12a4 4 0 100-8 4 4 0 000 8zM8 0a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0V.75A.75.75 0 018 0zm0 13a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 018 13zM2.343 2.343a.75.75 0 011.061 0l1.06 1.061a.75.75 0 01-1.06 1.06l-1.061-1.06a.75.75 0 010-1.061zm9.193 9.193a.75.75 0 011.06 0l1.061 1.06a.75.75 0 01-1.061 1.061l-1.06-1.06a.75.75 0 010-1.061zM16 8a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0116 8zM3 8a.75.75 0 01-.75.75H.75a.75.75 0 010-1.5h1.5A.75.75 0 013 8zm10.657-5.657a.75.75 0 010 1.061l-1.06 1.06a.75.75 0 01-1.061-1.06l1.06-1.061a.75.75 0 011.061 0zm-9.193 9.193a.75.75 0 010 1.06l-1.06 1.061a.75.75 0 01-1.061-1.061l1.06-1.06a.75.75 0 011.061 0z"></path>
        </svg>
      </button>
      <button @click="handleLogout" class="logout-btn">
        <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
          <path d="M2 2.75C2 1.784 2.784 1 3.75 1h2.5a.75.75 0 010 1.5h-2.5a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h2.5a.75.75 0 010 1.5h-2.5A1.75 1.75 0 012 13.25V2.75zm10.44 4.5H6.75a.75.75 0 000 1.5h5.69l-1.97 1.97a.75.75 0 101.06 1.06l3.25-3.25a.75.75 0 000-1.06l-3.25-3.25a.75.75 0 10-1.06 1.06l1.97 1.97z"></path>
        </svg>
        <span>退出登录</span>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { useAuthStore } from '../stores/auth'
import { useSettingsStore } from '../stores/settings'

const authStore = useAuthStore()
const settingsStore = useSettingsStore()

function toggleTheme() {
  const newTheme = settingsStore.theme === 'light' ? 'dark' : 'light'
  settingsStore.setTheme(newTheme)
}

async function handleLogout() {
  if (confirm('确定要退出登录吗?')) {
    await authStore.logout()
  }
}
</script>

<style scoped>
.sidebar {
  width: 260px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: sticky;
  top: 0;
}

.user-info {
  padding: 24px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--border-color);
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid var(--border-color);
}

.user-details {
  flex: 1;
  min-width: 0;
}

.username {
  font-weight: 600;
  font-size: 16px;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-name {
  font-size: 14px;
  color: #7f8c8d;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-menu {
  flex: 1;
  padding: 16px 0;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  color: var(--text-color);
  text-decoration: none;
  transition: background 0.2s;
}

.nav-item:hover {
  background: rgba(102, 126, 234, 0.1);
}

.nav-item.active {
  background: rgba(102, 126, 234, 0.15);
  color: var(--primary-color);
  border-right: 3px solid var(--primary-color);
}

.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.theme-toggle {
  width: 100%;
  padding: 10px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.theme-toggle:hover {
  background: var(--border-color);
}

.logout-btn {
  width: 100%;
  padding: 10px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  transition: background 0.2s;
}

.logout-btn:hover {
  background: #fee;
  color: #c33;
  border-color: #fcc;
}
</style>
