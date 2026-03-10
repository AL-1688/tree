<template>
  <div class="export-panel">
    <el-button type="primary" :disabled="disabled" @click="handleExport('srt')">
      导出 SRT
    </el-button>
    <el-button type="success" :disabled="disabled" @click="handleExport('txt')">
      导出 TXT
    </el-button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { downloadSRT } from '../utils/srtFormatter.js';
import { downloadTXT } from '../utils/txtFormatter.js';

const props = defineProps({
  subtitles: { type: Array, default: () => [] },
});

const disabled = computed(() => props.subtitles.length === 0);

function handleExport(format) {
  if (props.subtitles.length === 0) return;

  const timestamp = new Date().toISOString().slice(0, 10);

  if (format === 'srt') {
    downloadSRT(props.subtitles, `subtitle_${timestamp}.srt`);
  } else {
    downloadTXT(props.subtitles, `subtitle_${timestamp}.txt`);
  }
}
</script>

<style scoped>
.export-panel {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 16px;
  background-color: white;
  border-radius: 8px;
}
</style>
