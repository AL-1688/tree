import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const accessToken = ref(null)
  const oauthConfig = ref({
    clientId: null,
    clientSecret: null
  })

  const isAuthenticated = computed(() => !!accessToken.value)

  // 初始化 - 尝试加载已存储的 token
  async function init() {
    try {
      const token = await window.electronAPI.auth.getStoredToken()
      if (token) {
        accessToken.value = token
        await fetchUser()
      }
    } catch (error) {
      console.error('Failed to init auth:', error)
    }
  }

  // 登录
  async function login(config) {
    try {
      const result = await window.electronAPI.auth.login(config)
      if (result.success) {
        accessToken.value = result.accessToken
        oauthConfig.value = config
        await fetchUser()
        return { success: true }
      }
      return { success: false, error: result.error }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // 获取用户信息
  async function fetchUser() {
    try {
      const userData = await window.electronAPI.api.getCurrentUser()
      user.value = userData
      return userData
    } catch (error) {
      console.error('Failed to fetch user:', error)
      throw error
    }
  }

  // 登出
  async function logout() {
    try {
      await window.electronAPI.auth.logout()
      user.value = null
      accessToken.value = null
    } catch (error) {
      console.error('Failed to logout:', error)
    }
  }

  return {
    user,
    accessToken,
    oauthConfig,
    isAuthenticated,
    init,
    login,
    fetchUser,
    logout
  }
})
