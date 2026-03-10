<template>
  <div class="subtitle-list">
    <div class="list-header">
      <span>字幕列表 ({{ subtitles.length }} 条)</span>
      <el-button size="small" @click="$emit('add')">添加</el-button>
    </div>
    <div class="list-content">
      <div
        v-for="subtitle in sortedSubtitles"
        :key="subtitle.id"
        class="subtitle-item"
        :class="{ active: activeId === subtitle.id }"
        @click="$emit('select', subtitle.id)"
      >
        <div class="subtitle-index">#{{ subtitle.index }}</div>
        <div class="subtitle-time">
          <template v-if="editingId === subtitle.id">
            <el-input
              v-model="editForm.startTime"
              size="small"
              placeholder="开始时间"
              style="width: 60px"
              @click.stop
            />
            <span style="margin: 0 4px">-</span>
            <el-input
              v-model="editForm.endTime"
              size="small"
              placeholder="结束时间"
              style="width: 60px"
              @click.stop
            />
          </template>
          <template v-else>
            {{ formatTime(subtitle.startTime) }} - {{ formatTime(subtitle.endTime) }}
          </template>
        </div>
        <div class="subtitle-text">
          <template v-if="editingId === subtitle.id">
            <el-input
              v-model="editForm.text"
              size="small"
              placeholder="字幕文本"
              @click.stop
              @keyup.enter="saveEdit"
              @keyup.esc="cancelEdit"
            />
          </template>
          <template v-else>
            {{ subtitle.text }}
          </template>
        </div>
        <div class="subtitle-actions">
          <template v-if="editingId === subtitle.id">
            <el-button size="small" type="primary" @click.stop="saveEdit">
              <el-icon><Check /></el-icon>
            </el-button>
            <el-button size="small" @click.stop="cancelEdit">
              <el-icon><Close /></el-icon>
            </el-button>
          </template>
          <template v-else>
            <el-button size="small" text @click.stop="startEdit(subtitle)">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button size="small" text type="danger" @click.stop="confirmDelete(subtitle)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </div>
      </div>
      <div v-if="subtitles.length === 0" class="empty-state">
        <p>暂无字幕，上传音频后将自动生成</p>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <el-dialog
      v-model="deleteDialogVisible"
      title="确认删除"
      width="300px"
    >
      <p>确定要删除这条字幕吗？</p>
      <template #footer>
        <el-button @click="deleteDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="doDelete">删除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { Edit, Delete, Check, Close } from '@element-plus/icons-vue';
import { formatPlayTime } from '../utils/timeUtils.js';

const props = defineProps({
  subtitles: { type: Array, default: () => [] },
  currentTime: { type: Number, default: 0 },
  activeId: { type: String, default: null },
});

const emit = defineEmits(['select', 'edit', 'delete', 'add', 'update']);

const sortedSubtitles = computed(() => {
  return [...props.subtitles].sort((a, b) => a.startTime - b.startTime);
});

// 编辑状态
const editingId = ref(null);
const editForm = reactive({
  startTime: '',
  endTime: '',
  text: '',
});

// 删除确认
const deleteDialogVisible = ref(false);
const deleteTargetId = ref(null);

function formatTime(seconds) {
  return formatPlayTime(seconds);
}

function formatTimeToSeconds(timeStr) {
  const match = timeStr.match(/(\d+):(\d+)/);
  if (!match) return 0;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}

function startEdit(subtitle) {
  editingId.value = subtitle.id;
  editForm.startTime = formatTime(subtitle.startTime);
  editForm.endTime = formatTime(subtitle.endTime);
  editForm.text = subtitle.text;
}

function saveEdit() {
  if (!editingId.value) return;

  const subtitle = props.subtitles.find(s => s.id === editingId.value);
  if (!subtitle) return;

  emit('update', {
    id: editingId.value,
    startTime: formatTimeToSeconds(editForm.startTime),
    endTime: formatTimeToSeconds(editForm.endTime),
    text: editForm.text,
  });

  editingId.value = null;
}

function cancelEdit() {
  editingId.value = null;
}

function confirmDelete(subtitle) {
  deleteTargetId.value = subtitle.id;
  deleteDialogVisible.value = true;
}

function doDelete() {
  if (deleteTargetId.value) {
    emit('delete', deleteTargetId.value);
  }
  deleteDialogVisible.value = false;
  deleteTargetId.value = null;
}
</script>

<style scoped>
.subtitle-list {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
}

.list-content {
  flex: 1;
  overflow-y: auto;
}

.subtitle-item {
  display: grid;
  grid-template-columns: 50px 140px 1fr auto;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
  cursor: pointer;
  transition: background-color 0.2s;
}

.subtitle-item:hover {
  background-color: #f5f7fa;
}

.subtitle-item.active {
  background-color: #ecf5ff;
}

.subtitle-index {
  font-weight: bold;
  color: #409eff;
}

.subtitle-time {
  font-size: 12px;
  color: #909399;
  display: flex;
  align-items: center;
}

.subtitle-text {
  padding: 0 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subtitle-actions {
  display: flex;
  gap: 4px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: #909399;
}
</style>
