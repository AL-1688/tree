<template>
  <div class="audio-uploader">
    <el-upload
      class="upload-area"
      drag
      :auto-upload="false"
      :show-file-list="false"
      :accept="acceptTypes"
      @change="handleFileChange"
    >
      <el-icon class="upload-icon"><Upload /></el-icon>
      <div class="upload-text">
        <p>拖拽音频文件到此处，或<em>点击上传</em></p>
        <p class="upload-tip">支持 MP3、WAV、M4A、OGG、FLAC 格式</p>
      </div>
    </el-upload>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { Upload } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const emit = defineEmits(['upload-success']);

const acceptTypes = '.mp3,.wav,.m4a,.mp4,.ogg,.flac';
const maxSize = 100 * 1024 * 1024; // 100MB

function handleFileChange(file) {
  const audioFile = file.raw;

  // 验证文件类型
  const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', 'audio/flac', 'audio/x-flac'];
  if (!validTypes.includes(audioFile.type) && !isValidExtension(audioFile.name)) {
    ElMessage.error('不支持的文件格式');
    return;
  }

  // 验证文件大小
  if (audioFile.size > maxSize) {
    ElMessage.error('文件大小超过 100MB 限制');
    return;
  }

  emit('upload-success', audioFile);
}

function isValidExtension(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return ['mp3', 'wav', 'm4a', 'mp4', 'ogg', 'flac'].includes(ext);
}
</script>

<style scoped>
.audio-uploader {
  width: 100%;
}

.upload-area {
  width: 100%;
}

.upload-area :deep(.el-upload-dragger) {
  width: 100%;
  height: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.upload-icon {
  font-size: 48px;
  color: var(--primary-color);
  margin-bottom: 16px;
}

.upload-text {
  text-align: center;
}

.upload-text p {
  margin: 0;
  color: var(--text-secondary);
}

.upload-text em {
  color: var(--primary-color);
  font-style: normal;
}

.upload-tip {
  font-size: 12px;
  margin-top: 8px;
}
</style>
