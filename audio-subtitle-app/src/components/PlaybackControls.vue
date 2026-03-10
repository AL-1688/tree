<template>
  <div class="playback-controls">
    <div class="control-buttons">
      <el-button circle @click="handlePlayPause">
        <el-icon v-if="isPlaying"><VideoPause /></el-icon>
        <el-icon v-else><VideoPlay /></el-icon>
      </el-button>
    </div>
    <div class="progress-bar">
      <el-slider
        v-model="progressValue"
        :format-tooltip="formatTooltip"
        @change="handleSeek"
      />
    </div>
    <div class="time-display">
      {{ formatPlayTime(currentTime) }} / {{ formatPlayTime(duration) }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { VideoPlay, VideoPause } from '@element-plus/icons-vue';
import { formatPlayTime } from '../utils/timeUtils.js';

const props = defineProps({
  currentTime: { type: Number, default: 0 },
  duration: { type: Number, default: 0 },
  isPlaying: { type: Boolean, default: false },
});

const emit = defineEmits(['play', 'pause', 'seek']);

const progressValue = computed({
  get: () => {
    if (props.duration === 0) return 0;
    return (props.currentTime / props.duration) * 100;
  },
  set: () => {},
});

function handlePlayPause() {
  if (props.isPlaying) {
    emit('pause');
  } else {
    emit('play');
  }
}

function handleSeek(value) {
  const time = (value / 100) * props.duration;
  emit('seek', time);
}

function formatTooltip(value) {
  const time = (value / 100) * props.duration;
  return formatPlayTime(time);
}
</script>

<style scoped>
.playback-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background-color: white;
  border-radius: 8px;
}

.control-buttons {
  flex-shrink: 0;
}

.progress-bar {
  flex: 1;
}

.time-display {
  flex-shrink: 0;
  min-width: 100px;
  text-align: right;
  font-size: 14px;
  color: #606266;
}
</style>
