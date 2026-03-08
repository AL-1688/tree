<template>
  <el-dialog
    v-model="dialogVisible"
    title="文件冲突检测"
    width="600px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    class="conflict-dialog"
  >
    <!-- 冲突说明 -->
    <div class="conflict-header">
      <el-icon class="warning-icon"><WarningFilled /></el-icon>
      <span>检测到 {{ conflicts.length }} 个文件与远程仓库存在冲突</span>
    </div>

    <!-- 冲突文件列表 -->
    <div class="conflict-list">
      <el-table :data="conflicts" max-height="300" stripe>
        <el-table-column prop="path" label="文件路径" min-width="200">
          <template #default="{ row }">
            <div class="file-path">
              <el-icon><Document /></el-icon>
              <span :title="row.path">{{ row.path }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="本地大小" width="100">
          <template #default="{ row }">
            {{ formatSize(row.localSize) }}
          </template>
        </el-table-column>
        <el-table-column label="远程大小" width="100">
          <template #default="{ row }">
            {{ formatSize(row.remoteSize) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row, $index }">
            <el-select
              v-model="row.resolution"
              size="small"
              placeholder="选择操作"
              :disabled="applyToAll"
            >
              <el-option label="覆盖" value="overwrite" />
              <el-option label="跳过" value="skip" />
              <el-option label="重命名" value="rename" />
            </el-select>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新文件提示 -->
    <div v-if="newFiles.length > 0" class="new-files-tip">
      <el-icon class="success-icon"><CircleCheck /></el-icon>
      <span>{{ newFiles.length }} 个新文件将被直接上传</span>
    </div>

    <!-- 相同文件提示 -->
    <div v-if="identicalFiles.length > 0" class="identical-files-tip">
      <el-icon class="info-icon"><InfoFilled /></el-icon>
      <span>{{ identicalFiles.length }} 个文件内容相同，将自动跳过</span>
    </div>

    <!-- 统一处理选项 -->
    <div class="apply-all-option">
      <el-checkbox v-model="applyToAll">
        对所有冲突文件应用相同操作
      </el-checkbox>
      <el-select
        v-if="applyToAll"
        v-model="globalResolution"
        size="small"
        placeholder="选择统一操作"
        style="margin-left: 12px"
      >
        <el-option label="全部覆盖" value="overwrite" />
        <el-option label="全部跳过" value="skip" />
        <el-option label="全部重命名" value="rename" />
      </el-select>
    </div>

    <!-- Git LFS 提示 -->
    <div v-if="hasLargeFiles" class="lfs-tip">
      <el-icon class="warning-icon"><WarningFilled /></el-icon>
      <div class="lfs-content">
        <span>部分文件超过 50MB，建议使用 Git LFS 管理</span>
        <el-link type="primary" href="https://git-lfs.github.com/" target="_blank">
          了解 Git LFS
        </el-link>
      </div>
    </div>

    <!-- 底部操作 -->
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleCancel">取消上传</el-button>
        <el-button type="primary" @click="handleConfirm">
          确认并开始上传
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import {
  WarningFilled,
  Document,
  CircleCheck,
  InfoFilled
} from '@element-plus/icons-vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  conflicts: {
    type: Array,
    default: () => []
  },
  newFiles: {
    type: Array,
    default: () => []
  },
  identicalFiles: {
    type: Array,
    default: () => []
  },
  hasLargeFiles: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['resolve', 'cancel'])

// 对话框可见性
const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => {
    if (!val) {
      handleCancel()
    }
  }
})

// 统一处理选项
const applyToAll = ref(false)
const globalResolution = ref('overwrite')

// 为每个冲突初始化解决方案
const localConflicts = ref([])

watch(() => props.conflicts, (newConflicts) => {
  localConflicts.value = newConflicts.map(c => ({
    ...c,
    resolution: 'overwrite'
  }))
}, { immediate: true })

// 当启用统一处理时，更新所有冲突的解决方案
watch([applyToAll, globalResolution], ([isApplyAll, resolution]) => {
  if (isApplyAll) {
    localConflicts.value.forEach(c => {
      c.resolution = resolution
    })
  }
})

// 方法
function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function handleConfirm() {
  const resolutions = localConflicts.value.map(c => ({
    path: c.path,
    resolution: c.resolution
  }))

  emit('resolve', {
    strategy: applyToAll.value ? globalResolution.value : 'mixed',
    applyToAll: applyToAll.value,
    resolutions
  })
}

function handleCancel() {
  emit('cancel')
}
</script>

<style scoped>
.conflict-dialog .conflict-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fdf6ec;
  border-radius: var(--radius-md);
  margin-bottom: 16px;
  color: var(--warning-color);
}

.conflict-header .warning-icon {
  font-size: 20px;
}

.conflict-list {
  margin-bottom: 16px;
}

.file-path {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-path span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.new-files-tip,
.identical-files-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  margin-bottom: 12px;
}

.new-files-tip {
  background: #f0f9eb;
  color: var(--success-color);
}

.identical-files-tip {
  background: #f4f4f5;
  color: var(--info-color);
}

.success-icon,
.info-icon {
  font-size: 18px;
}

.apply-all-option {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-top: 1px solid var(--border-light);
  border-bottom: 1px solid var(--border-light);
  margin-bottom: 16px;
}

.lfs-tip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  background: #fef0f0;
  border-radius: var(--radius-md);
  margin-bottom: 16px;
}

.lfs-tip .warning-icon {
  color: var(--error-color);
  font-size: 20px;
  flex-shrink: 0;
}

.lfs-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
