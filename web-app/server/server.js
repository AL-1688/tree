import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import dotenv from 'dotenv'

dotenv.config()

const app = express()

// 中间件
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}))
app.use(express.json())

// 状态存储（生产环境应使用 Redis 等）
const stateStore = new Map()
const tokenStore = new Map()

// GitHub OAuth 配置
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// 生成随机 state
function generateState() {
  return crypto.randomBytes(16).toString('hex')
}

// 验证 GitHub 配置
if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
  console.warn('Warning: GitHub OAuth credentials not configured!')
  console.warn('Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env file')
}

// ========== 路由 ==========

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 获取 OAuth 配置状态
app.get('/api/auth/status', (req, res) => {
  res.json({
    configured: !!(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET),
    clientId: GITHUB_CLIENT_ID || null
  })
})

// 发起 OAuth 登录
app.get('/api/auth/login', (req, res) => {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return res.status(500).json({ error: 'OAuth not configured' })
  }

  const state = generateState()
  const sessionId = crypto.randomBytes(16).toString('hex')

  // 存储 state，5分钟过期
  stateStore.set(state, {
    sessionId,
    createdAt: Date.now()
  })

  // 构建 GitHub OAuth URL
  const authUrl = new URL('https://github.com/login/oauth/authorize')
  authUrl.searchParams.set('client_id', GITHUB_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', `${req.protocol}://${req.get('host')}/api/auth/callback`)
  authUrl.searchParams.set('scope', 'repo user')
  authUrl.searchParams.set('state', state)

  res.json({
    authUrl: authUrl.toString(),
    sessionId
  })
})

// OAuth 回调
app.get('/api/auth/callback', async (req, res) => {
  const { code, state } = req.query

  // 验证 state
  const stateData = stateStore.get(state)
  if (!stateData) {
    return res.redirect(`${FRONTEND_URL}/login?error=invalid_state`)
  }

  // 清除已使用的 state
  stateStore.delete(state)

  // 检查是否过期（5分钟）
  if (Date.now() - stateData.createdAt > 5 * 60 * 1000) {
    return res.redirect(`${FRONTEND_URL}/login?error=expired`)
  }

  try {
    // 用 code 换取 access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${req.protocol}://${req.get('host')}/api/auth/callback`
      })
    })

    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      console.error('GitHub token error:', tokenData.error)
      return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`)
    }

    const accessToken = tokenData.access_token

    // 获取用户信息
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    })

    const userData = await userResponse.json()

    // 存储 token（生产环境应使用数据库或 Redis）
    tokenStore.set(stateData.sessionId, {
      accessToken,
      user: userData,
      createdAt: Date.now()
    })

    // 重定向到前端，携带 sessionId
    res.redirect(`${FRONTEND_URL}/auth/callback?sessionId=${stateData.sessionId}`)
  } catch (error) {
    console.error('OAuth callback error:', error)
    res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error.message)}`)
  }
})

// 获取 token（前端通过 sessionId 获取）
app.get('/api/auth/token/:sessionId', (req, res) => {
  const { sessionId } = req.params
  const data = tokenStore.get(sessionId)

  if (!data) {
    return res.status(404).json({ error: 'Session not found or expired' })
  }

  // 检查是否过期（1小时）
  if (Date.now() - data.createdAt > 60 * 60 * 1000) {
    tokenStore.delete(sessionId)
    return res.status(404).json({ error: 'Session expired' })
  }

  // 返回后清除 sessionId（一次性使用）
  tokenStore.delete(sessionId)

  res.json({
    accessToken: data.accessToken,
    user: data.user
  })
})

// 代理 GitHub API 请求（可选，用于避免 CORS）
app.get('/api/github/*', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const path = req.params[0]
  const query = new URLSearchParams(req.query).toString()
  const url = `https://api.github.com/${path}${query ? '?' + query : ''}`

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/vnd.github.v3+json'
      }
    })

    const data = await response.json()
    res.status(response.status).json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 定期清理过期的 state 和 token
setInterval(() => {
  const now = Date.now()

  // 清理过期 state（5分钟）
  for (const [key, value] of stateStore.entries()) {
    if (now - value.createdAt > 5 * 60 * 1000) {
      stateStore.delete(key)
    }
  }

  // 清理过期 token（1小时）
  for (const [key, value] of tokenStore.entries()) {
    if (now - value.createdAt > 60 * 60 * 1000) {
      tokenStore.delete(key)
    }
  }
}, 60 * 1000)

// 启动服务器
const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Frontend URL: ${FRONTEND_URL}`)
  console.log(`OAuth configured: ${!!(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET)}`)
})
