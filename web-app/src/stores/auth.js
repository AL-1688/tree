import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { githubApi } from '@/services/github-api'

const TOKEN_KEY = 'github_token'
const USER_KEY = 'github_user'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(null)
  const user = ref(null)

  const isAuthenticated = computed(() => !!token.value)

  function initAuth() {
    const savedToken = localStorage.getItem(TOKEN_KEY)
    const savedUser = localStorage.getItem(USER_KEY)

    if (savedToken) {
      token.value = savedToken
      if (savedUser) {
        try {
          user.value = JSON.parse(savedUser)
        } catch (e) {
          console.error('Failed to parse saved user:', e)
        }
      }
      // 设置 API token
      githubApi.setToken(savedToken)
    }
  }

  async function login(accessToken) {
    try {
      token.value = accessToken
      githubApi.setToken(accessToken)

      // 获取用户信息验证 token
      const userData = await githubApi.getCurrentUser()
      user.value = userData

      // 保存到 localStorage
      localStorage.setItem(TOKEN_KEY, accessToken)
      localStorage.setItem(USER_KEY, JSON.stringify(userData))

      return { success: true }
    } catch (error) {
      token.value = null
      user.value = null
      githubApi.setToken(null)
      return { success: false, error: error.message }
    }
  }

  function logout() {
    token.value = null
    user.value = null
    githubApi.setToken(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  return {
    token,
    user,
    isAuthenticated,
    initAuth,
    login,
    logout
  }
})
