# GitHub 客户端管理工具

一个基于 Electron + Vue 3 构建的 GitHub 桌面客户端应用,提供完整的仓库和文件管理功能。

## 功能特性

- **OAuth 授权登录** - 简化的 GitHub OAuth 授权流程
- **仓库管理** - 查看、创建、编辑、删除仓库
- **文件浏览** - 浏览仓库文件结构,查看文件内容
- **文件上传** - 上传本地文件夹到 GitHub 仓库
- **文件编辑** - 在线编辑仓库文件(开发中)
- **主题切换** - 支持浅色/深色主题
- **跨平台** - 支持 Windows、macOS、Linux

## 技术栈

- **前端框架**: Vue 3 + Vite
- **桌面框架**: Electron
- **状态管理**: Pinia
- **路由管理**: Vue Router
- **HTTP 客户端**: Axios
- **构建工具**: Electron Builder

## 快速开始

### 前置要求

- Node.js 16+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
# 启动 Vite 开发服务器
npm run dev

# 在另一个终端启动 Electron
npm run electron:start

# 或者使用并发命令同时启动
npm run electron:dev
```

### 构建应用

```bash
# 构建前端
npm run build

# 打包 Electron 应用
npm run electron:build
```

## 配置 GitHub OAuth

### 1. 注册 GitHub OAuth App

1. 访问 [GitHub Developer Settings](https://github.com/settings/developers)
2. 点击 "New OAuth App"
3. 填写应用信息:
   - **Application name**: GitHub Client
   - **Homepage URL**: `http://localhost:8888`
   - **Authorization callback URL**: `http://localhost:8888/callback`
4. 创建后获取 Client ID 和 Client Secret

### 2. 在应用中配置

1. 启动应用后点击 "配置 OAuth"
2. 输入 Client ID 和 Client Secret
3. 点击 "保存配置"
4. 点击 "登录 GitHub" 完成授权

## 项目结构

```
github-client/
├── electron/                 # Electron 主进程
│   ├── main.js              # 主进程入口
│   ├── preload.js           # 预加载脚本
│   ├── auth/                # OAuth 认证模块
│   │   └── github-oauth.js
│   ├── api/                 # GitHub API 封装
│   │   └── github-api.js
│   ├── fs/                  # 文件系统模块
│   │   └── folder-reader.js
│   └── storage/             # 本地存储模块
│       └── local-storage.js
├── src/                     # Vue 3 前端代码
│   ├── views/               # 页面视图
│   │   ├── Login.vue
│   │   ├── Dashboard.vue
│   │   ├── RepositoryDetail.vue
│   │   ├── FileBrowser.vue
│   │   ├── RepositorySettings.vue
│   │   └── Settings.vue
│   ├── components/          # Vue 组件
│   ├── stores/              # Pinia 状态管理
│   ├── router/              # 路由配置
│   ├── styles/              # 样式文件
│   ├── App.vue
│   └── main.js
├── index.html               # HTML 模板
├── vite.config.js           # Vite 配置
└── package.json             # 项目配置
```

## 使用指南

### 登录

1. 首次使用需要配置 GitHub OAuth App
2. 点击 "登录 GitHub" 按钮
3. 在浏览器中完成授权
4. 自动返回应用并完成登录

### 仓库管理

- **查看仓库**: 登录后自动显示仓库列表,支持搜索和筛选
- **创建仓库**: 点击 "创建仓库" 按钮,填写信息后创建
- **删除仓库**: 进入仓库设置页面,在危险区域删除仓库

### 文件操作

- **浏览文件**: 点击仓库进入文件浏览器,支持文件夹导航
- **查看文件**: 点击文件查看内容预览
- **上传文件**: 在仓库详情页点击 "上传文件夹" 上传本地文件

### 设置

- **主题切换**: 在设置页面选择浅色或深色主题
- **OAuth 配置**: 更新 GitHub OAuth App 配置
- **上传设置**: 配置默认分支和并发上传数

## 开发说明

### 主进程 API

主进程通过 IPC 暴露了以下 API:

```javascript
// OAuth 认证
window.electronAPI.auth.login(config)
window.electronAPI.auth.logout()
window.electronAPI.auth.getStoredToken()

// GitHub API
window.electronAPI.api.getCurrentUser()
window.electronAPI.api.getRepositories(params)
window.electronAPI.api.createRepository(params)
window.electronAPI.api.deleteRepository(owner, repo)
window.electronAPI.api.getRepositoryContent(params)
window.electronAPI.api.uploadFile(params)
// ... 更多 API

// 文件系统
window.electronAPI.fs.selectFolder()
window.electronAPI.fs.readFolderStructure(folderPath)

// 本地存储
window.electronAPI.storage.get(key)
window.electronAPI.storage.set(key, value)
window.electronAPI.storage.delete(key)
```

### 状态管理

应用使用 Pinia 进行状态管理,主要包含以下 stores:

- **auth**: 认证状态(用户信息、Token)
- **repository**: 仓库状态(仓库列表、当前仓库)
- **settings**: 设置状态(主题、配置)

## 已知问题

- 文件编辑功能需要进一步开发
- 大文件上传需要优化
- 断点续传功能需要完善

## 贡献指南

欢迎提交 Issue 和 Pull Request!

## 许可证

MIT License

## 致谢

本项目使用以下开源技术构建:

- [Electron](https://www.electronjs.org/)
- [Vue 3](https://vuejs.org/)
- [Vite](https://vitejs.dev/)
- [Pinia](https://pinia.vuejs.org/)
- [GitHub REST API](https://docs.github.com/en/rest)
