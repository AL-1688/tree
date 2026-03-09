const { shell, safeStorage } = require('electron')
const http = require('http')
const crypto = require('crypto')
const LocalStorage = require('../storage/local-storage')

// OAuth 回调端口范围
const PORT_RANGE = { min: 8888, max: 8898 }
const MAX_PORT_RETRIES = 10

class GitHubOAuth {
  constructor() {
    this.clientId = null
    this.clientSecret = null
    this.localStorage = new LocalStorage()
    this.server = null
    this.port = PORT_RANGE.min
    this.state = null
  }

  setConfig(clientId, clientSecret) {
    this.clientId = clientId
    this.clientSecret = clientSecret
  }

  /**
   * 尝试在指定端口范围内启动服务器
   * @returns {Promise<number>} 成功监听的端口
   */
  async findAvailablePort() {
    return new Promise((resolve, reject) => {
      const tryPort = (port, attemptsLeft) => {
        if (attemptsLeft <= 0) {
          reject(new Error('Unable to find available port for OAuth callback'))
          return
        }

        const testServer = http.createServer()

        testServer.once('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            // 端口被占用，尝试下一个
            testServer.close()
            tryPort(port + 1, attemptsLeft - 1)
          } else {
            reject(err)
          }
        })

        testServer.once('listening', () => {
          const boundPort = testServer.address().port
          testServer.close(() => resolve(boundPort))
        })

        testServer.listen(port)
      }

      tryPort(this.port, MAX_PORT_RETRIES)
    })
  }

  async authenticate() {
    if (!this.clientId || !this.clientSecret) {
      // 尝试从本地存储加载配置
      const config = await this.localStorage.get('oauth_config')
      if (config) {
        this.clientId = config.clientId
        this.clientSecret = config.clientSecret
      } else {
        throw new Error('OAuth configuration not found')
      }
    }

    // 查找可用端口
    this.port = await this.findAvailablePort()

    return new Promise((resolve, reject) => {
      // 生成随机 state 参数
      this.state = crypto.randomBytes(16).toString('hex')

      // 设置超时，防止用户长时间不操作
      const timeout = setTimeout(() => {
        if (this.server) {
          this.server.close()
        }
        reject(new Error('Authentication timeout'))
      }, 5 * 60 * 1000) // 5 分钟超时

      // 创建本地服务器监听回调
      this.server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url, `http://localhost:${this.port}`)

          if (url.pathname === '/callback') {
            const code = url.searchParams.get('code')
            const returnedState = url.searchParams.get('state')

            if (returnedState !== this.state) {
              throw new Error('State mismatch - possible CSRF attack')
            }

            // 使用 code 交换 access token
            const accessToken = await this.exchangeCodeForToken(code)

            // 安全存储 token
            await this.storeToken(accessToken)

            // 返回成功响应
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(`
              <html>
                <head><title>Authentication Successful</title></head>
                <body>
                  <h2>Authentication successful!</h2>
                  <p>You can close this window now.</p>
                  <script>setTimeout(() => window.close(), 2000)</script>
                </body>
              </html>
            `)

            // 清理
            clearTimeout(timeout)
            this.server.close()
            this.state = null

            resolve({ success: true, accessToken })
          } else {
            // 处理未知路径
            res.writeHead(404)
            res.end('Not found')
          }
        } catch (error) {
          clearTimeout(timeout)
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end(`
            <html>
              <head><title>Authentication Failed</title></head>
              <body>
                <h2>Authentication failed</h2>
                <p>Please try again.</p>
              </body>
            </html>
          `)
          this.server.close()
          this.state = null
          reject(new Error('Authentication failed'))
        }
      })

      this.server.listen(this.port, () => {
        // 构建 OAuth URL
        const authUrl = new URL('https://github.com/login/oauth/authorize')
        authUrl.searchParams.set('client_id', this.clientId)
        authUrl.searchParams.set('redirect_uri', `http://localhost:${this.port}/callback`)
        authUrl.searchParams.set('scope', 'repo user')
        authUrl.searchParams.set('state', this.state)

        // 打开浏览器
        shell.openExternal(authUrl.toString())
      })

      // 处理服务器错误
      this.server.on('error', (err) => {
        clearTimeout(timeout)
        reject(new Error('Failed to start authentication server'))
      })
    })
  }

  async exchangeCodeForToken(code) {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code
      })
    })

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error_description || data.error)
    }

    return data.access_token
  }

  async storeToken(token) {
    // 使用 safeStorage 加密存储
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token)
      await this.localStorage.set('github_token_encrypted', encrypted.toString('base64'))
    } else {
      // 降级存储(不推荐,但在某些系统上可能需要)
      await this.localStorage.set('github_token', token)
    }
  }

  async getStoredToken() {
    try {
      // 优先尝试读取加密的 token
      const encrypted = await this.localStorage.get('github_token_encrypted')
      if (encrypted && safeStorage.isEncryptionAvailable()) {
        const buffer = Buffer.from(encrypted, 'base64')
        return safeStorage.decryptString(buffer)
      }

      // 降级读取明文 token
      return await this.localStorage.get('github_token')
    } catch (error) {
      return null
    }
  }

  async logout() {
    await this.localStorage.delete('github_token_encrypted')
    await this.localStorage.delete('github_token')
  }
}

module.exports = GitHubOAuth
