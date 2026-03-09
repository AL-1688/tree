import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { githubApi } from '@/services/github-api'

const TOKEN_KEY = 'github_token'
const USER_KEY = 'github_user'

// 后端服务地址
const API_BASE = '/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(null)
  const user = ref(null)
  const oauthConfigured = ref(false)

  const isAuthenticated = computed(() => !!token.value)

  async function initAuth() {
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

    // 检查后端 OAuth 配置状态
    try {
      const response = await fetch(`${API_BASE}/auth/status`)
      const data = await response.json()
      oauthConfigured.value = data.configured
    } catch (e) {
      console.error('Failed to check OAuth status:', e)
      oauthConfigured.value = false
    }
  }

  // Token 登录方式
  async function loginWithToken(accessToken) {
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

  // OAuth 登录方式
  async function loginWithOAuth() {
    try {
      // 获取 OAuth 登录 URL
      const response = await fetch(`${API_BASE}/auth/login`)
      const data = await response.json()

      if (data.error) {
        return { success: false, error: data.error }
      }

      // 打开新窗口进行 OAuth 授权
      const width = 600
      const height = 700
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2

      const authWindow = window.open(
        data.authUrl,
        'GitHub OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      )

      // 等待 OAuth 回调完成，通过 sessionId 获取 token
      return new Promise((resolve) => {
        const checkClosed = setInterval(() => {
          if (authWindow.closed) {
            clearInterval(checkClosed)
            // 尝试通过 sessionId 获取 token
            fetchToken(data.sessionId).then(result => {
              resolve(result)
            }).catch(() => {
              resolve({ success: false, error: 'OAuth 登录失败' })
            })
          }
        }, 500)

        // 超时处理
        setTimeout(() => {
          clearInterval(checkClosed)
          if (!authWindow.closed) {
            authWindow.close()
          }
          resolve({ success: false, error: 'OAuth 登录超时' })
        }, 5 * 60 * 1000)
      })
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // 通过 sessionId 获取 token
  async function fetchToken(sessionId) {
    try {
      const response = await fetch(`${API_BASE}/auth/token/${sessionId}`)
      const data = await response.json()

      if (data.error) {
        return { success: false, error: data.error }
      }

      token.value = data.accessToken
      user.value = data.user
      githubApi.setToken(data.accessToken)

      // 保存到 localStorage
      localStorage.setItem(TOKEN_KEY, data.accessToken)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))

      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // 兼容旧版 login 方法
  async function login(accessToken) {
    return loginWithToken(accessToken)
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
    oauthConfigured,
    isAuthenticated,
    initAuth,
    login,
    loginWithToken,
    loginWithOAuth,
    logout
  }
})
