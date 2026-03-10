import { ref } from 'vue';
import { pipeline, env } from '@xenova/transformers';
import { useTranscriptStore } from '../stores/transcriptStore.js';
import { useSubtitleStore } from '../stores/subtitleStore.js';

// 配置 Transformers.js
// 注意：本地模型需要在 public/models/ 目录下预先放置模型文件
env.allowLocalModels = true;
env.localModelPath = '/models/';
env.useBrowserCache = true;  // 使用浏览器缓存（IndexedDB）

// CDN 源列表，按优先级排序（针对中国用户优化）
const CDN_SOURCES = [
  { host: 'https://hf-mirror.com', name: 'HF Mirror (China)' },
  { host: 'https://huggingface.co', name: 'Hugging Face' },
];

let currentCdnIndex = 0;
let modelLoadAttempts = 0;
const MAX_RETRY_ATTEMPTS = 3;

// 配置当前 CDN
function configureCdn(index = 0) {
  if (index < CDN_SOURCES.length) {
    env.remoteHost = CDN_SOURCES[index].host;
    console.log(`Using CDN: ${CDN_SOURCES[index].name} (${CDN_SOURCES[index].host})`);
    return true;
  }
  return false;
}

// 初始化 CDN 配置
configureCdn(currentCdnIndex);

export function useWhisperTranscriber() {
  const transcriptStore = useTranscriptStore();
  const subtitleStore = useSubtitleStore();

  const isModelLoading = ref(false);
  const modelLoaded = ref(false);
  const currentModel = ref('tiny');
  const transcriber = ref(null);
  const loadProgress = ref(0);
  const statusMessage = ref('');

  // 可用模型列表
  const availableModels = ['tiny', 'base', 'small', 'medium'];

  // 切换到下一个 CDN 源
  function switchToNextCdn() {
    currentCdnIndex++;
    if (currentCdnIndex < CDN_SOURCES.length) {
      configureCdn(currentCdnIndex);
      return true;
    }
    return false;
  }

  // 检查本地模型是否存在
  async function checkLocalModelExists(modelName) {
    try {
      // 检查关键文件是否存在
      const response = await fetch(`/models/Xenova/whisper-${modelName}/onnx/model_quantized.onnx`, {
        method: 'HEAD'
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // 加载模型（支持本地模型和 CDN）
  async function loadModel(modelName = 'tiny', retryCount = 0, forceRemote = false) {
    isModelLoading.value = true;
    currentModel.value = modelName;
    loadProgress.value = 0;
    statusMessage.value = '正在初始化...';

    try {
      transcriptStore.setProgress(5);

      console.log(`Loading Whisper model: ${modelName}, attempt: ${retryCount + 1}, forceRemote: ${forceRemote}`);

      let modelPath;
      let useLocal = false;

      // 检查本地模型
      if (!forceRemote) {
        const localExists = await checkLocalModelExists(modelName);
        if (localExists) {
          useLocal = true;
          modelPath = `/models/Xenova/whisper-${modelName}`;
          env.remoteHost = '';
          console.log(`Using local model: ${modelPath}`);
          statusMessage.value = '正在加载本地模型...';
        }
      }

      // 使用 CDN
      if (!useLocal) {
        modelPath = `Xenova/whisper-${modelName}`;
        configureCdn(currentCdnIndex);
        console.log(`Using CDN: ${CDN_SOURCES[currentCdnIndex].name}`);
        statusMessage.value = `正在从 ${CDN_SOURCES[currentCdnIndex].name} 下载模型...`;
      }

      transcriber.value = await pipeline(
        'automatic-speech-recognition',
        modelPath,
        {
          progress_callback: (progress) => {
            console.log('Model loading progress:', progress);
            if (progress.status === 'progress' && progress.total > 0) {
              const percent = Math.round((progress.loaded / progress.total) * 100);
              loadProgress.value = percent;
              transcriptStore.setProgress(Math.min(95, 5 + percent * 0.9));
              statusMessage.value = useLocal
                ? `正在加载本地模型 (${percent}%)...`
                : `正在下载模型 (${percent}%)...`;
            } else if (progress.status === 'done') {
              loadProgress.value = 100;
              transcriptStore.setProgress(100);
              statusMessage.value = '模型加载完成';
            }
          },
        }
      );

      modelLoaded.value = true;
      modelLoadAttempts = 0;
      statusMessage.value = '模型已就绪';
      return transcriber.value;
    } catch (err) {
      console.error('Model loading error:', err);

      // 如果使用本地模型失败，尝试 CDN
      if (useLocal && retryCount === 0) {
        console.log('Local model failed, trying CDN...');
        currentCdnIndex = 0;
        return loadModel(modelName, retryCount + 1, true);
      }

      // 尝试切换 CDN
      if (retryCount < MAX_RETRY_ATTEMPTS - 1) {
        if (switchToNextCdn()) {
          statusMessage.value = `切换到 ${CDN_SOURCES[currentCdnIndex].name} 重试...`;
          return loadModel(modelName, retryCount + 1, true);
        }
      }

      // 所有重试都失败
      const errorMsg = getDetailedErrorMessage(err);
      transcriptStore.setError(errorMsg);
      statusMessage.value = `加载失败: ${err.message}`;
      throw new Error(errorMsg);
    } finally {
      isModelLoading.value = false;
    }
  }

  // 获取详细的错误信息
  function getDetailedErrorMessage(err) {
    const errorMsg = err.message || '未知错误';

    if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
      return `网络连接失败，无法下载模型。请检查网络连接后重试。建议使用 VPN 或代理访问 Hugging Face。`;
    }
    if (errorMsg.includes('out of memory') || errorMsg.includes('memory')) {
      return `内存不足，请尝试使用更小的模型 (tiny) 或关闭其他应用后重试。`;
    }
    if (errorMsg.includes('timeout')) {
      return `连接超时，请检查网络连接后重试。`;
    }
    if (errorMsg.includes('CORS')) {
      return `跨域请求被阻止，请联系管理员配置服务器。`;
    }

    return `模型加载失败: ${errorMsg}`;
  }

  // 执行语音识别
  async function transcribe(audioBuffer, options = {}) {
    if (!transcriber.value) {
      await loadModel(currentModel.value);
    }

    transcriptStore.setTranscribing(true);
    transcriptStore.setProgress(0);
    statusMessage.value = '正在处理音频...';

    try {
      // 验证音频数据
      if (!audioBuffer || !audioBuffer.getChannelData) {
        throw new Error('无效的音频数据');
      }

      // 将 AudioBuffer 转换为适合 Whisper 的格式
      const audioData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;

      console.log(`Audio info: sampleRate=${sampleRate}, length=${audioData.length}`);

      // Whisper 需要 16kHz 采样率
      const targetSampleRate = 16000;
      const resampledData = resampleAudio(audioData, sampleRate, targetSampleRate);

      console.log(`Resampled audio: ${resampledData.length} samples at ${targetSampleRate}Hz`);

      statusMessage.value = '正在进行语音识别...';

      // 执行识别
      const result = await transcriber.value(resampledData, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
        language: options.language || 'chinese',
        task: 'transcribe',
      });

      console.log('Transcription result:', result);

      // 处理识别结果
      const chunks = processTranscriptResult(result);

      if (chunks.length === 0) {
        throw new Error('未能识别出任何内容，请检查音频是否包含清晰的语音');
      }

      // 保存到 store
      transcriptStore.setTranscript({
        text: result.text,
        chunks,
        language: options.language || 'chinese',
        model: currentModel.value,
      });

      // 自动生成字幕
      generateSubtitlesFromChunks(chunks);

      statusMessage.value = '识别完成';
      return {
        text: result.text,
        chunks,
      };
    } catch (err) {
      console.error('Transcription error:', err);
      const errorMsg = getDetailedErrorMessage(err);
      transcriptStore.setError(errorMsg);
      statusMessage.value = `识别失败: ${err.message}`;
      throw new Error(errorMsg);
    } finally {
      transcriptStore.setTranscribing(false);
    }
  }

  // 重采样音频
  function resampleAudio(audioData, originalRate, targetRate) {
    if (originalRate === targetRate) {
      return audioData;
    }

    const ratio = originalRate / targetRate;
    const newLength = Math.floor(audioData.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const index = Math.floor(i * ratio);
      result[i] = audioData[index];
    }

    return result;
  }

  // 处理识别结果
  function processTranscriptResult(result) {
    const chunks = [];

    if (result.chunks) {
      result.chunks.forEach((chunk, index) => {
        const text = chunk.text ? chunk.text.trim() : '';
        if (text) {
          chunks.push({
            id: `chunk_${Date.now()}_${index}`,
            text,
            start: chunk.timestamp?.[0] ?? 0,
            end: chunk.timestamp?.[1] ?? 0,
            confidence: 1,
          });
        }
      });
    } else if (result.text) {
      // 处理没有 chunks 的情况
      chunks.push({
        id: `chunk_${Date.now()}_0`,
        text: result.text.trim(),
        start: result.timestamp?.[0] ?? 0,
        end: result.timestamp?.[1] ?? 0,
        confidence: 1,
      });
    }

    return chunks;
  }

  // 从识别结果生成字幕
  function generateSubtitlesFromChunks(chunks) {
    const subtitles = chunks.map((chunk, index) => ({
      id: `sub_${Date.now()}_${index}`,
      index: index + 1,
      startTime: chunk.start,
      endTime: chunk.end,
      text: chunk.text,
      isModified: false,
      source: 'whisper',
    }));

    subtitleStore.setSubtitles(subtitles);
  }

  // 重试加载
  async function retry() {
    currentCdnIndex = 0;
    configureCdn(currentCdnIndex);
    return loadModel(currentModel.value, 0);
  }

  return {
    isModelLoading,
    modelLoaded,
    currentModel,
    availableModels,
    loadProgress,
    statusMessage,
    loadModel,
    transcribe,
    retry,
  };
}
