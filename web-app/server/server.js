import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import dotenv from 'dotenv'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

dotenv.config()

const app = express()

// ========== 配置常量 ==========
const CONFIG = {
  STATE_EXPIRY_MS: 5 * 60 * 1000,      // 5分钟
  TOKEN_EXPIRY_MS: 60 * 60 * 1000,      // 1小时
  SESSION_ID_LENGTH: 32,                 // 32字节
  CLEANUP_INTERVAL_MS: 60 * 1000,        // 1分钟
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,  // 15分钟
  RATE_LIMIT_MAX: 100                    // 每个 IP 最多 100 次请求
}

// ========== 安全中间件 ==========

// Helmet 安全头
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.github.com"]
    }
  },
  crossOriginEmbedderPolicy: false
}))

// CORS 配置
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())

app.use(cors({
  origin: (origin, callback) => {
    // 允许无 origin 的请求（如移动应用、Postman）
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}))

app.use(express.json())

// ========== 速率限制 ==========

// 通用 API 限制
const apiLimiter = rateLimit({
  windowMs: CONFIG.RATE_LIMIT_WINDOW_MS,
  max: CONFIG.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' }
})

// 认证接口更严格的限制
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 15分钟内最多 10 次
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '登录尝试次数过多，请稍后再试' }
})

// 应用速率限制
app.use('/api/auth', authLimiter)
app.use('/api', apiLimiter)

// ========== 状态存储（生产环境应使用 Redis） ==========

const stateStore = new Map()
const tokenStore = new Map()

// ========== GitHub OAuth 配置 ==========

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// 验证 GitHub 配置
if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
  console.warn('Warning: GitHub OAuth credentials not configured!')
  console.warn('Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env file')
}

// ========== 工具函数 ==========

/**
 * 生成安全的随机字符串
 * @param {number} bytes 字节数
 * @returns {string} 十六进制字符串
 */
function generateSecureToken(bytes = CONFIG.SESSION_ID_LENGTH) {
  return crypto.randomBytes(bytes).toString('hex')
}

/**
 * 验证 sessionId 格式
 * @param {string} sessionId
 * @returns {boolean}
 */
function isValidSessionId(sessionId) {
  return typeof sessionId === 'string' && /^[a-f0-9]{64}$/.test(sessionId)
}

/**
 * 获取客户端 IP
 * @param {Request} req
 * @returns {string}
 */
function getClientIp(req) {
  return req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown'
}

// ========== 路由 ==========

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    oauthConfigured: !!(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET)
  })
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

  const state = generateSecureToken(16)
  const sessionId = generateSecureToken(32)
  const clientIp = getClientIp(req)

  // 存储 state，绑定客户端 IP
  stateStore.set(state, {
    sessionId,
    clientIp,
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

  // 验证 state 格式
  if (typeof state !== 'string' || !/^[a-f0-9]{32}$/.test(state)) {
    return res.redirect(`${FRONTEND_URL}/login?error=invalid_state_format`)
  }

  // 验证 state 存在性
  const stateData = stateStore.get(state)
  if (!stateData) {
    return res.redirect(`${FRONTEND_URL}/login?error=invalid_state`)
  }

  // 清除已使用的 state（防止重放攻击）
  stateStore.delete(state)

  // 检查是否过期
  if (Date.now() - stateData.createdAt > CONFIG.STATE_EXPIRY_MS) {
    return res.redirect(`${FRONTEND_URL}/login?error=expired`)
  }

  // 验证客户端 IP（可选，增强安全性）
  const currentIp = getClientIp(req)
  if (stateData.clientIp !== currentIp) {
    console.warn(`IP mismatch: expected ${stateData.clientIp}, got ${currentIp}`)
    // 在严格模式下可以拒绝请求
    // return res.redirect(`${FRONTEND_URL}/login?error=ip_mismatch`)
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

    // 存储 token
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

  // 验证 sessionId 格式
  if (!isValidSessionId(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID format' })
  }

  const data = tokenStore.get(sessionId)

  if (!data) {
    return res.status(404).json({ error: 'Session not found or expired' })
  }

  // 检查是否过期
  if (Date.now() - data.createdAt > CONFIG.TOKEN_EXPIRY_MS) {
    tokenStore.delete(sessionId)
    return res.status(404).json({ error: 'Session expired' })
  }

  // 返回后清除 sessionId（一次性使用）
  tokenStore.delete(sessionId)

  // 过滤敏感信息
  const safeUser = {
    id: data.user.id,
    login: data.user.login,
    name: data.user.name,
    email: data.user.email,
    avatar_url: data.user.avatar_url,
    bio: data.user.bio,
    public_repos: data.user.public_repos,
    followers: data.user.followers,
    following: data.user.following
  }

  res.json({
    accessToken: data.accessToken,
    user: safeUser
  })
})

// 代理 GitHub API 请求（可选，用于避免 CORS）
app.get('/api/github/*', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const path = req.params[0]

  // 验证路径，防止路径遍历
  if (path.includes('..') || path.includes('\0')) {
    return res.status(400).json({ error: 'Invalid path' })
  }

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

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS policy violation' })
  }
  res.status(500).json({ error: 'Internal server error' })
})

// ========== 定期清理过期数据 ==========

setInterval(() => {
  const now = Date.now()

  for (const [key, value] of stateStore.entries()) {
    if (now - value.createdAt > CONFIG.STATE_EXPIRY_MS) {
      stateStore.delete(key)
    }
  }

  for (const [key, value] of tokenStore.entries()) {
    if (now - value.createdAt > CONFIG.TOKEN_EXPIRY_MS) {
      tokenStore.delete(key)
    }
  }
}, CONFIG.CLEANUP_INTERVAL_MS)

// ========== 启动服务器 ==========

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Frontend URL: ${FRONTEND_URL}`)
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`)
  console.log(`OAuth configured: ${!!(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET)}`)
})
