<template>
  <div class="waveform-editor" ref="containerRef">
    <canvas ref="canvasRef" class="waveform-canvas" @click="handleCanvasClick"></canvas>
    <div class="subtitle-markers" v-if="subtitles.length > 0">
      <div
        v-for="subtitle in subtitles"
        :key="subtitle.id"
        class="subtitle-marker"
        :class="{ active: activeId === subtitle.id }"
        :style="getMarkerStyle(subtitle)"
        @click="$emit('subtitle-select', subtitle.id)"
      >
        <span class="marker-label">{{ subtitle.index }}</span>
      </div>
    </div>
    <div class="playhead" :style="{ left: playheadPosition + 'px' }"></div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  waveformData: { type: Float32Array, default: null },
  subtitles: { type: Array, default: () => [] },
  currentTime: { type: Number, default: 0 },
  duration: { type: Number, default: 0 },
  activeId: { type: String, default: null },
});

const emit = defineEmits(['time-select', 'region-select', 'subtitle-select']);

const containerRef = ref(null);
const canvasRef = ref(null);
const zoom = ref(1);
const scroll = ref(0);

const playheadPosition = computed(() => {
  if (!props.duration || !canvasRef.value) return 0;
  const canvasWidth = canvasRef.value.width;
  return (props.currentTime / props.duration) * canvasWidth;
});

onMounted(() => {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
});

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas);
});

watch(() => props.waveformData, () => {
  drawWaveform();
}, { immediate: true });

watch(() => props.currentTime, () => {
  drawWaveform();
});

function resizeCanvas() {
  if (!containerRef.value || !canvasRef.value) return;
  canvasRef.value.width = containerRef.value.clientWidth;
  canvasRef.value.height = 100;
  drawWaveform();
}

function drawWaveform() {
  const canvas = canvasRef.value;
  if (!canvas || !props.waveformData) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const data = props.waveformData;

  // 清除画布
  ctx.fillStyle = '#1A1A2E';
  ctx.fillRect(0, 0, width, height);

  // 绘制波形
  ctx.strokeStyle = '#4FC3F7';
  ctx.lineWidth = 1;
  ctx.beginPath();

  const step = width / data.length;
  const midY = height / 2;

  for (let i = 0; i < data.length; i++) {
    const x = i * step;
    const y = midY + data[i] * midY * 0.8;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();

  // 绘制镜像
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = i * step;
    const y = midY - data[i] * midY * 0.8;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

function getMarkerStyle(subtitle) {
  if (!props.duration || !canvasRef.value) return {};
  const canvasWidth = canvasRef.value.width;
  const left = (subtitle.startTime / props.duration) * canvasWidth;
  const width = ((subtitle.endTime - subtitle.startTime) / props.duration) * canvasWidth;
  return {
    left: left + 'px',
    width: Math.max(width, 10) + 'px',
  };
}

function handleCanvasClick(event) {
  const canvas = canvasRef.value;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const time = (x / canvas.width) * props.duration;
  emit('time-select', time);
}
</script>

<style scoped>
.waveform-editor {
  position: relative;
  width: 100%;
  height: 120px;
  background-color: #1A1A2E;
  border-radius: 8px;
  overflow: hidden;
}

.waveform-canvas {
  width: 100%;
  height: 100%;
  cursor: pointer;
}

.subtitle-markers {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 20px;
}

.subtitle-marker {
  position: absolute;
  top: 0;
  height: 100%;
  background-color: rgba(64, 158, 255, 0.5);
  cursor: pointer;
  border-radius: 2px;
}

.subtitle-marker.active {
  background-color: rgba(103, 194, 58, 0.7);
}

.marker-label {
  font-size: 10px;
  color: white;
  padding: 0 4px;
}

.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background-color: #FF5252;
  pointer-events: none;
}
</style>
