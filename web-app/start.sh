#!/bin/bash

# GitHub Client Web - 启动脚本

echo "=========================================="
echo "  GitHub Client Web - 启动服务"
echo "=========================================="

# 检查 .env 文件
if [ ! -f server/.env ]; then
    echo ""
    echo "警告: server/.env 文件不存在!"
    echo "请复制 server/.env.example 为 server/.env 并配置 GitHub OAuth 凭证"
    echo ""
    echo "配置步骤:"
    echo "1. 访问 https://github.com/settings/developers"
    echo "2. 创建新的 OAuth App"
    echo "3. 设置 Authorization callback URL: http://localhost:3001/api/auth/callback"
    echo "4. 复制 Client ID 和 Client Secret 到 server/.env"
    echo ""
    echo "如果暂时不需要 OAuth，可以使用 Token 登录方式"
    echo ""
fi

# 启动后端服务
echo "启动后端服务..."
cd server
node server.js &
BACKEND_PID=$!
cd ..

# 等待后端启动
sleep 2

# 检查后端是否启动成功
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "错误: 后端服务启动失败"
    exit 1
fi

echo ""
echo "=========================================="
echo "  服务已启动!"
echo "=========================================="
echo "  前端地址: http://localhost:5173"
echo "  后端地址: http://localhost:3001"
echo "=========================================="
echo ""

# 启动前端服务
npm run dev

# 清理
trap "kill $BACKEND_PID 2>/dev/null" EXIT
