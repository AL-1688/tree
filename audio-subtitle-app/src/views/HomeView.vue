<template>
  <div class="home-view">
    <!-- 头部 -->
    <header class="app-header">
      <div class="header-left">
        <h1 class="app-title">音频字幕生成器</h1>
      </div>
      <div class="header-right">
        <el-select v-model="selectedModel" size="small" placeholder="选择模型">
          <el-option label="tiny (最快)" value="tiny" />
          <el-option label="base (推荐)" value="base" />
          <el-option label="small (较慢)" value="small" />
          <el-option label="medium (最慢)" value="medium" />
        </el-select>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="app-main">
      <!-- 上传区域 -->
      <section v-if="!audioStore.hasAudio" class="upload-section">
        <AudioUploader @upload-success="handleAudioUpload" />
      </section>

      <!-- 编辑区域 -->
      <template v-else>
        <!-- 文档上传 -->
        <section class="document-section">
          <el-card shadow="hover">
            <template #header>
              <div class="card-header">
                <span>参考文档（可选）</span>
                <el-switch
                  v-model="preprocessEnabled"
                  active-text="删除标点"
                  @change="handlePreprocessToggle"
                />
              </div>
            </template>
            <div class="document-upload">
              <input
                type="file"
                ref="docInputRef"
                accept=".txt,.doc,.docx"
                style="display: none"
                @change="handleDocumentUpload"
              />
              <el-button @click="$refs.docInputRef.click()">
                {{ documentStore.hasDocument ? '更换文档' : '上传文档' }}
              </el-button>
              <span v-if="documentStore.hasDocument" class="doc-info">
                {{ documentStore.file?.name }}
              </span>
            </div>
            <div v-if="documentStore.rawContent" class="doc-preview">
              <div class="preview-label">文档内容预览：</div>
              <pre>{{ documentStore.content.substring(0, 200) }}...</pre>
            </div>
          </el-card>
        </section>

        <!-- 识别状态 -->
        <section v-if="transcriptStore.isTranscribing" class="transcribe-section">
          <el-card>
            <div class="transcribe-status">
              <el-progress
                :percentage="transcriptStore.progress"
                :status="transcriptStore.progress === 100 ? 'success' : ''"
              />
              <p>正在识别中，请稍候...</p>
            </div>
          </el-card>
        </section>

        <!-- 播放控制 -->
        <section class="playback-section">
          <PlaybackControls
            :current-time="audioStore.currentTime"
            :duration="audioStore.duration"
            :is-playing="audioStore.isPlaying"
            @play="handlePlay"
            @pause="handlePause"
            @seek="handleSeek"
          />
        </section>

        <!-- 波形编辑器 -->
        <section class="waveform-section">
          <WaveformEditor
            :waveform-data="audioStore.waveformData"
            :subtitles="subtitleStore.sortedSubtitles"
            :current-time="audioStore.currentTime"
            :duration="audioStore.duration"
            :active-id="subtitleStore.activeId"
            @time-select="handleSeek"
            @subtitle-select="handleSubtitleSelect"
          />
        </section>

        <!-- 智能对齐按钮 -->
        <section v-if="canAlign" class="align-section">
          <el-button
            type="primary"
            :loading="isAligning"
            @click="handleAlign"
          >
            智能对齐
          </el-button>
        </section>

        <!-- 字幕列表 -->
        <section class="subtitle-section">
          <SubtitleList
            :subtitles="subtitleStore.subtitles"
            :current-time="audioStore.currentTime"
            :active-id="subtitleStore.activeId"
            @select="handleSubtitleSelect"
            @edit="handleSubtitleEdit"
            @delete="handleSubtitleDelete"
            @add="handleSubtitleAdd"
          />
        </section>

        <!-- 导出 -->
        <section class="export-section">
          <ExportPanel :subtitles="subtitleStore.sortedSubtitles" />
        </section>
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';

// Stores
import { useAudioStore } from '../stores/audioStore.js';
import { useSubtitleStore } from '../stores/subtitleStore.js';
import { useTranscriptStore } from '../stores/transcriptStore.js';
import { useDocumentStore } from '../stores/documentStore.js';

// Composables
import { useAudioProcessor } from '../composables/useAudioProcessor.js';
import { useDocumentParser } from '../composables/useDocumentParser.js';
import { useWhisperTranscriber } from '../composables/useWhisperTranscriber.js';
import { useTextAligner } from '../composables/useTextAligner.js';

// Components
import AudioUploader from '../components/AudioUploader.vue';
import WaveformEditor from '../components/WaveformEditor.vue';
import SubtitleList from '../components/SubtitleList.vue';
import PlaybackControls from '../components/PlaybackControls.vue';
import ExportPanel from '../components/ExportPanel.vue';

// Stores
const audioStore = useAudioStore();
const subtitleStore = useSubtitleStore();
const transcriptStore = useTranscriptStore();
const documentStore = useDocumentStore();

// Composables
const { loadAudio, play, pause, seek, dispose } = useAudioProcessor();
const { parseFile, togglePreprocess } = useDocumentParser();
const { loadModel, transcribe } = useWhisperTranscriber();
const { align, isAligning } = useTextAligner();

// State
const selectedModel = ref('tiny');
const preprocessEnabled = ref(true);
const docInputRef = ref(null);

// Computed
const canAlign = computed(() => {
  return transcriptStore.hasTranscript && documentStore.hasDocument;
});

// Handlers
async function handleAudioUpload(file) {
  try {
    await loadAudio(file);
    ElMessage.success('音频加载成功');

    // 自动开始识别
    await handleTranscribe();
  } catch (err) {
    ElMessage.error(`音频加载失败: ${err.message}`);
  }
}

async function handleTranscribe() {
  try {
    await loadModel(selectedModel.value);
    await transcribe(audioStore.audioBuffer);
    ElMessage.success('语音识别完成');
  } catch (err) {
    ElMessage.error(`语音识别失败: ${err.message}`);
  }
}

async function handleDocumentUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    await parseFile(file);
    ElMessage.success('文档加载成功');
  } catch (err) {
    ElMessage.error(`文档加载失败: ${err.message}`);
  }
}

function handlePreprocessToggle(enabled) {
  togglePreprocess(enabled);
}

async function handleAlign() {
  try {
    const result = align(documentStore.content);
    ElMessage.success(`对齐完成，共 ${result.subtitles.length} 条字幕`);
  } catch (err) {
    ElMessage.error(`对齐失败: ${err.message}`);
  }
}

function handlePlay() {
  play();
}

function handlePause() {
  pause();
}

function handleSeek(time) {
  seek(time);
}

function handleSubtitleSelect(id) {
  subtitleStore.setActive(id);
}

function handleSubtitleEdit(id) {
  subtitleStore.setEditing(id);
}

function handleSubtitleDelete(id) {
  subtitleStore.deleteSubtitle(id);
}

function handleSubtitleAdd() {
  // 添加新字幕
  subtitleStore.addSubtitle({
    startTime: audioStore.currentTime,
    endTime: audioStore.currentTime + 3,
    text: '新字幕',
    source: 'manual',
  });
}

// Cleanup
onUnmounted(() => {
  dispose();
});
</script>

<style scoped>
.home-view {
  min-height: 100vh;
  background-color: var(--bg-color);
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.app-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.app-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.upload-section {
  max-width: 600px;
  margin: 0 auto;
}

.document-section,
.transcribe-section,
.playback-section,
.waveform-section,
.align-section,
.subtitle-section,
.export-section {
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.document-upload {
  display: flex;
  align-items: center;
  gap: 12px;
}

.doc-info {
  color: var(--text-secondary);
  font-size: 14px;
}

.doc-preview {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e4e7ed;
}

.preview-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.doc-preview pre {
  background-color: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: pre-wrap;
}

.transcribe-status {
  text-align: center;
  padding: 20px;
}

.subtitle-section {
  min-height: 300px;
}
</style>
