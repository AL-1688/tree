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
          {{ formatTime(subtitle.startTime) }} - {{ formatTime(subtitle.endTime) }}
        </div>
        <div class="subtitle-text">{{ subtitle.text }}</div>
        <div class="subtitle-actions">
          <el-button size="small" text @click.stop="$emit('edit', subtitle.id)">
            <el-icon><Edit /></el-icon>
          </el-button>
          <el-button size="small" text type="danger" @click.stop="$emit('delete', subtitle.id)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Edit, Delete } from '@element-plus/icons-vue';
import { formatPlayTime } from '../utils/timeUtils.js';

const props = defineProps({
  subtitles: { type: Array, default: () => [] },
  currentTime: { type: Number, default: 0 },
  activeId: { type: String, default: null },
});

defineEmits(['select', 'edit', 'delete', 'add']);

const sortedSubtitles = computed(() => {
  return [...props.subtitles].sort((a, b) => a.startTime - b.startTime);
});

function formatTime(seconds) {
  return formatPlayTime(seconds);
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
  grid-template-columns: 50px 120px 1fr auto;
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
</style>
