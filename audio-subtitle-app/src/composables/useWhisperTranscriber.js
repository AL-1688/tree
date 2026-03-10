import { ref } from 'vue';
import { useTranscriptStore } from '../stores/transcriptStore.js';
import { useSubtitleStore } from '../stores/subtitleStore.js';

export function useWhisperTranscriber() {
  const transcriptStore = useTranscriptStore();
  const subtitleStore = useSubtitleStore();

  const isModelLoading = ref(false);
  const modelLoaded = ref(false);
  const currentModel = ref('tiny');
  const transcriber = ref(null);

  // 可用模型列表
  const availableModels = ['tiny', 'base', 'small', 'medium'];

  // 加载模型
  async function loadModel(modelName = 'tiny') {
    isModelLoading.value = true;
    currentModel.value = modelName;

    try {
      const { pipeline } = await import('@xenova/transformers');

      transcriber.value = await pipeline(
        'automatic-speech-recognition',
        `Xenova/whisper-${modelName}`,
        {
          progress_callback: (progress) => {
            if (progress.status === 'progress') {
              transcriptStore.setProgress(Math.round(progress.progress));
            }
          },
        }
      );

      modelLoaded.value = true;
      return transcriber.value;
    } catch (err) {
      transcriptStore.setError(`模型加载失败: ${err.message}`);
      throw err;
    } finally {
      isModelLoading.value = false;
    }
  }

  // 执行语音识别
  async function transcribe(audioBuffer, options = {}) {
    if (!transcriber.value) {
      await loadModel(currentModel.value);
    }

    transcriptStore.setTranscribing(true);
    transcriptStore.setProgress(0);

    try {
      // 将 AudioBuffer 转换为适合 Whisper 的格式
      const audioData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;

      // Whisper 需要 16kHz 采样率
      const targetSampleRate = 16000;
      const resampledData = resampleAudio(audioData, sampleRate, targetSampleRate);

      // 执行识别
      const result = await transcriber.value(resampledData, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
        language: options.language || 'chinese',
        task: 'transcribe',
      });

      // 处理识别结果
      const chunks = processTranscriptResult(result);

      // 保存到 store
      transcriptStore.setTranscript({
        text: result.text,
        chunks,
        language: options.language || 'chinese',
        model: currentModel.value,
      });

      // 自动生成字幕
      generateSubtitlesFromChunks(chunks);

      return {
        text: result.text,
        chunks,
      };
    } catch (err) {
      transcriptStore.setError(`语音识别失败: ${err.message}`);
      throw err;
    } finally {
      transcriptStore.setTranscribing(false);
    }
  }

  // 重采样音频
  function resampleAudio(audioData, originalRate, targetRate) {
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
        chunks.push({
          id: `chunk_${Date.now()}_${index}`,
          text: chunk.text.trim(),
          start: chunk.timestamp[0] || 0,
          end: chunk.timestamp[1] || 0,
          confidence: 1,
        });
      });
    } else if (result.timestamp) {
      // 处理单个时间戳的情况
      chunks.push({
        id: `chunk_${Date.now()}_0`,
        text: result.text.trim(),
        start: result.timestamp[0] || 0,
        end: result.timestamp[1] || 0,
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

  return {
    isModelLoading,
    modelLoaded,
    currentModel,
    availableModels,
    loadModel,
    transcribe,
  };
}
