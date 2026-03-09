<template>
  <div class="repositories-page">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-input
        v-model="searchQuery"
        placeholder="搜索仓库..."
        clearable
        style="width: 300px"
        @keyup.enter="handleSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <el-button type="primary" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon>
        新建仓库
      </el-button>
    </div>

    <!-- 仓库列表 -->
    <el-table
      v-loading="loading"
      :data="repositories"
      style="width: 100%"
      @row-click="handleRowClick"
    >
      <el-table-column label="仓库名称" min-width="200">
        <template #default="{ row }">
          <div class="repo-name">
            <el-icon><Folder /></el-icon>
            <span>{{ row.full_name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="300" show-overflow-tooltip />
      <el-table-column label="可见性" width="100">
        <template #default="{ row }">
          <el-tag :type="row.private ? 'danger' : 'success'" size="small">
            {{ row.private ? '私有' : '公开' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="语言" width="120">
        <template #default="{ row }">
          <span v-if="row.language">{{ row.language }}</span>
          <span v-else style="color: #909399">-</span>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.updated_at) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button
            type="primary"
            link
            size="small"
            @click.stop="handleViewDetail(row)"
          >
            查看
          </el-button>
          <el-button
            type="primary"
            link
            size="small"
            @click.stop="openInBrowser(row.html_url)"
          >
            GitHub
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination" v-if="total > 0">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @current-change="fetchRepositories"
      />
    </div>

    <!-- 新建仓库对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      title="新建仓库"
      width="500px"
    >
      <el-form :model="createForm" :rules="createRules" ref="createFormRef" label-width="80px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="createForm.name" placeholder="仓库名称" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input
            v-model="createForm.description"
            type="textarea"
            :rows="3"
            placeholder="仓库描述（可选）"
          />
        </el-form-item>
        <el-form-item label="可见性">
          <el-radio-group v-model="createForm.private">
            <el-radio :value="false">公开</el-radio>
            <el-radio :value="true">私有</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="初始化">
          <el-checkbox v-model="createForm.auto_init">添加 README 文件</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreate" :loading="creating">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { githubApi } from '@/services/github-api'

const router = useRouter()

const loading = ref(false)
const repositories = ref([])
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(30)
const total = ref(0)

const showCreateDialog = ref(false)
const createFormRef = ref(null)
const creating = ref(false)

const createForm = reactive({
  name: '',
  description: '',
  private: false,
  auto_init: true
})

const createRules = {
  name: [
    { required: true, message: '请输入仓库名称', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9._-]+$/, message: '名称只能包含字母、数字、点、连字符和下划线', trigger: 'blur' }
  ]
}

onMounted(() => {
  fetchRepositories()
})

async function fetchRepositories() {
  loading.value = true
  try {
    const data = await githubApi.getRepositories({
      page: currentPage.value,
      per_page: pageSize.value
    })
    repositories.value = data
    total.value = data.length < pageSize.value ? (currentPage.value - 1) * pageSize.value + data.length : currentPage.value * pageSize.value + 1
  } catch (error) {
    ElMessage.error(error.message || '获取仓库列表失败')
  } finally {
    loading.value = false
  }
}

async function handleSearch() {
  if (!searchQuery.value.trim()) {
    fetchRepositories()
    return
  }

  loading.value = true
  try {
    const result = await githubApi.searchRepositories(searchQuery.value)
    repositories.value = result.items || []
    total.value = result.total_count || 0
  } catch (error) {
    ElMessage.error(error.message || '搜索失败')
  } finally {
    loading.value = false
  }
}

function handleRowClick(row) {
  router.push(`/repository/${row.owner.login}/${row.name}`)
}

function handleViewDetail(row) {
  router.push(`/repository/${row.owner.login}/${row.name}`)
}

function openInBrowser(url) {
  window.open(url, '_blank')
}

function formatDate(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN')
}

async function handleCreate() {
  if (!createFormRef.value) return

  await createFormRef.value.validate(async (valid) => {
    if (!valid) return

    creating.value = true
    try {
      await githubApi.createRepository({
        name: createForm.name,
        description: createForm.description || undefined,
        private: createForm.private,
        auto_init: createForm.auto_init
      })
      ElMessage.success('仓库创建成功')
      showCreateDialog.value = false
      resetCreateForm()
      fetchRepositories()
    } catch (error) {
      ElMessage.error(error.message || '创建失败')
    } finally {
      creating.value = false
    }
  })
}

function resetCreateForm() {
  createForm.name = ''
  createForm.description = ''
  createForm.private = false
  createForm.auto_init = true
}
</script>

<style scoped>
.repositories-page {
  background: #fff;
  padding: 20px;
  border-radius: 4px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.repo-name {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #409eff;
  cursor: pointer;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}
</style>
