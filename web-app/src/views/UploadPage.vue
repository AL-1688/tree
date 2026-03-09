<template>
  <div class="upload-page">
    <el-card>
      <template #header>
        <span>文件上传</span>
      </template>

      <!-- 目标仓库选择 -->
      <el-form :model="form" label-width="100px">
        <el-form-item label="目标仓库">
          <el-select v-model="form.repository" placeholder="选择仓库" filterable style="width: 400px">
            <el-option
              v-for="repo in repositories"
              :key="repo.full_name"
              :label="repo.full_name"
              :value="repo.full_name"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="目标分支">
          <el-input v-model="form.branch" placeholder="默认 main" style="width: 200px" />
        </el-form-item>

        <el-form-item label="目标路径">
          <el-input v-model="form.path" placeholder="例如: docs/ 或留空上传到根目录" style="width: 400px" />
        </el-form-item>
      </el-form>

      <!-- 文件上传区域 -->
      <el-upload
        ref="uploadRef"
        v-model:file-list="fileList"
        drag
        multiple
        :auto-upload="false"
        :on-change="handleFileChange"
      >
        <el-icon class="el-icon--upload"><Upload /></el-icon>
        <div class="el-upload__text">
          拖拽文件到此处，或 <em>点击选择文件</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持多文件上传，单个文件最大 100MB
          </div>
        </template>
      </el-upload>

      <!-- 操作按钮 -->
      <div class="actions">
        <el-button type="primary" @click="handleUpload" :loading="uploading">
          开始上传
        </el-button>
        <el-button @click="clearFiles">清空列表</el-button>
      </div>
    </el-card>

    <!-- 上传进度 -->
    <el-card v-if="uploadProgress.length > 0" class="progress-card">
      <template #header>
        <span>上传进度</span>
      </template>

      <div v-for="item in uploadProgress" :key="item.file" class="progress-item">
        <div class="progress-info">
          <span class="file-name">{{ item.file }}</span>
          <el-tag :type="getStatusType(item.status)" size="small">
            {{ getStatusText(item.status) }}
          </el-tag>
        </div>
        <el-progress
          :percentage="item.progress"
          :status="item.status === 'success' ? 'success' : item.status === 'error' ? 'exception' : ''"
        />
        <div v-if="item.error" class="error-msg">{{ item.error }}</div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { githubApi } from '@/services/github-api'

const uploadRef = ref(null)
const repositories = ref([])
const fileList = ref([])
const uploading = ref(false)
const uploadProgress = ref([])

const form = reactive({
  repository: '',
  branch: 'main',
  path: ''
})

onMounted(async () => {
  try {
    repositories.value = await githubApi.getRepositories()
  } catch (error) {
    ElMessage.error('获取仓库列表失败')
  }
})

function handleFileChange(file, files) {
  // 检查文件大小
  const maxSize = 100 * 1024 * 1024 // 100MB
  if (file.size > maxSize) {
    ElMessage.warning(`文件 ${file.name} 超过 100MB，可能上传失败`)
  }
}

async function handleUpload() {
  if (!form.repository) {
    ElMessage.warning('请选择目标仓库')
    return
  }

  if (fileList.value.length === 0) {
    ElMessage.warning('请选择要上传的文件')
    return
  }

  uploading.value = true
  uploadProgress.value = fileList.value.map(f => ({
    file: f.name,
    status: 'pending',
    progress: 0,
    error: null
  }))

  const [owner, repo] = form.repository.split('/')
  const basePath = form.path ? form.path.replace(/\/$/, '') + '/' : ''

  for (let i = 0; i < fileList.value.length; i++) {
    const file = fileList.value[i]
    const progressItem = uploadProgress.value[i]

    try {
      progressItem.status = 'uploading'

      // 读取文件内容
      const content = await readFileAsBase64(file.raw)

      // 上传到 GitHub
      const targetPath = basePath + file.name
      await githubApi.uploadFile(
        owner,
        repo,
        targetPath,
        content,
        `Upload ${file.name}`,
        form.branch || 'main'
      )

      progressItem.status = 'success'
      progressItem.progress = 100
    } catch (error) {
      progressItem.status = 'error'
      progressItem.error = error.message
    }
  }

  uploading.value = false
  ElMessage.success('上传完成')

  // 清空文件列表
  fileList.value = []
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // 移除 data:xxx;base64, 前缀
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function clearFiles() {
  fileList.value = []
  uploadProgress.value = []
}

function getStatusType(status) {
  const map = {
    pending: 'info',
    uploading: 'warning',
    success: 'success',
    error: 'danger'
  }
  return map[status] || 'info'
}

function getStatusText(status) {
  const map = {
    pending: '等待中',
    uploading: '上传中',
    success: '成功',
    error: '失败'
  }
  return map[status] || status
}
</script>

<style scoped>
.upload-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.actions {
  margin-top: 20px;
}

.progress-card {
  margin-top: 20px;
}

.progress-item {
  margin-bottom: 15px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.file-name {
  font-weight: 500;
}

.error-msg {
  color: #f56c6c;
  font-size: 12px;
  margin-top: 5px;
}
</style>
