<template>
  <div class="repository-detail-page" v-loading="loading">
    <!-- 仓库信息 -->
    <el-card v-if="repository" class="info-card">
      <div class="repo-header">
        <div class="repo-title">
          <h2>{{ repository.full_name }}</h2>
          <el-tag :type="repository.private ? 'danger' : 'success'" size="small">
            {{ repository.private ? '私有' : '公开' }}
          </el-tag>
        </div>
        <p class="repo-description">{{ repository.description || '暂无描述' }}</p>
        <div class="repo-stats">
          <span><el-icon><Star /></el-icon> {{ repository.stargazers_count }}</span>
          <span><el-icon><View /></el-icon> {{ repository.watchers_count }}</span>
          <span><el-icon><Share /></el-icon> {{ repository.forks_count }}</span>
        </div>
      </div>
    </el-card>

    <!-- 文件浏览 -->
    <el-card class="files-card">
      <template #header>
        <div class="files-header">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/repositories' }">仓库</el-breadcrumb-item>
            <el-breadcrumb-item>{{ owner }}/{{ repo }}</el-breadcrumb-item>
          </el-breadcrumb>
          <el-select v-model="selectedBranch" size="small" @change="loadTree">
            <el-option
              v-for="branch in branches"
              :key="branch.name"
              :label="branch.name"
              :value="branch.name"
            />
          </el-select>
        </div>
      </template>

      <el-table :data="files" style="width: 100%" @row-click="handleFileClick">
        <el-table-column label="名称" min-width="300">
          <template #default="{ row }">
            <div class="file-name">
              <el-icon v-if="row.type === 'tree'"><Folder /></el-icon>
              <el-icon v-else><Document /></el-icon>
              <span>{{ row.path.split('/').pop() }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            {{ row.type === 'tree' ? '目录' : '文件' }}
          </template>
        </el-table-column>
        <el-table-column label="大小" width="120">
          <template #default="{ row }">
            {{ row.size ? formatSize(row.size) : '-' }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 文件内容预览 -->
    <el-dialog v-model="showFileContent" :title="currentFile?.path" width="800px">
      <div class="file-content">
        <pre v-if="fileContent">{{ decodeContent(fileContent) }}</pre>
        <el-empty v-else description="无法预览此文件" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { githubApi } from '@/services/github-api'

const route = useRoute()
const owner = computed(() => route.params.owner)
const repo = computed(() => route.params.repo)

const loading = ref(false)
const repository = ref(null)
const branches = ref([])
const selectedBranch = ref('main')
const files = ref([])
const showFileContent = ref(false)
const currentFile = ref(null)
const fileContent = ref(null)

onMounted(async () => {
  await Promise.all([
    loadRepository(),
    loadBranches(),
    loadTree()
  ])
})

async function loadRepository() {
  try {
    repository.value = await githubApi.getRepository(owner.value, repo.value)
    selectedBranch.value = repository.value.default_branch || 'main'
  } catch (error) {
    ElMessage.error(error.message || '获取仓库信息失败')
  }
}

async function loadBranches() {
  try {
    branches.value = await githubApi.getBranches(owner.value, repo.value)
  } catch (error) {
    console.error('Failed to load branches:', error)
  }
}

async function loadTree() {
  loading.value = true
  try {
    const tree = await githubApi.getTree(owner.value, repo.value, selectedBranch.value)
    // 过滤根目录文件
    files.value = (tree.tree || []).filter(item => !item.path.includes('/'))
  } catch (error) {
    ElMessage.error(error.message || '获取文件列表失败')
  } finally {
    loading.value = false
  }
}

async function handleFileClick(row) {
  if (row.type === 'tree') {
    // 目录导航（简化版，暂不实现子目录）
    ElMessage.info('子目录浏览功能开发中')
  } else {
    // 预览文件
    try {
      const content = await githubApi.getFileContent(owner.value, repo.value, row.path, selectedBranch.value)
      if (content.type === 'file' && content.encoding === 'base64') {
        currentFile.value = row
        fileContent.value = content.content
        showFileContent.value = true
      }
    } catch (error) {
      ElMessage.error('无法加载文件内容')
    }
  }
}

function decodeContent(base64Content) {
  try {
    return decodeURIComponent(escape(atob(base64Content)))
  } catch {
    return atob(base64Content)
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>

<style scoped>
.repository-detail-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.info-card {
  background: #fff;
}

.repo-header {
  text-align: center;
}

.repo-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.repo-title h2 {
  margin: 0;
  font-size: 24px;
}

.repo-description {
  color: #606266;
  margin: 10px 0;
}

.repo-stats {
  display: flex;
  justify-content: center;
  gap: 20px;
  color: #909399;
}

.repo-stats span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.files-card {
  background: #fff;
}

.files-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.file-name {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #409eff;
}

.file-content {
  max-height: 500px;
  overflow: auto;
  background: #f5f7fa;
  padding: 15px;
  border-radius: 4px;
}

.file-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
