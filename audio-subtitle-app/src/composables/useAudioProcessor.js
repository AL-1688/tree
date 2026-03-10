import { ref } from 'vue';
import { useAudioStore } from '../stores/audioStore.js';

export function useAudioProcessor() {
  const audioStore = useAudioStore();
  const audioContext = ref(null);
  const sourceNode = ref(null);

  // 初始化音频上下文
  function initAudioContext() {
    if (!audioContext.value) {
      audioContext.value = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext.value;
  }

  // 加载音频文件
  async function loadAudio(file) {
    audioStore.setLoading(true);
    audioStore.setError(null);

    try {
      const ctx = initAudioContext();
      const arrayBuffer = await file.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);

      audioStore.setAudio(file, buffer);
      generateWaveformData(buffer);

      return buffer;
    } catch (err) {
      audioStore.setError(`音频加载失败: ${err.message}`);
      throw err;
    } finally {
      audioStore.setLoading(false);
    }
  }

  // 生成波形数据
  function generateWaveformData(buffer, width = 1000) {
    const channelData = buffer.getChannelData(0);
    const samples = width;
    const blockSize = Math.floor(channelData.length / samples);
    const waveformData = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(channelData[i * blockSize + j]);
      }
      waveformData[i] = sum / blockSize;
    }

    // 归一化
    const max = Math.max(...waveformData);
    if (max > 0) {
      for (let i = 0; i < waveformData.length; i++) {
        waveformData[i] /= max;
      }
    }

    audioStore.setWaveformData(waveformData);
    return waveformData;
  }

  // 播放音频
  function play(startTime = null) {
    if (!audioStore.audioBuffer) return;

    const ctx = initAudioContext();

    // 停止之前的播放
    if (sourceNode.value) {
      sourceNode.value.stop();
      sourceNode.value.disconnect();
    }

    sourceNode.value = ctx.createBufferSource();
    sourceNode.value.buffer = audioStore.audioBuffer;
    sourceNode.value.connect(ctx.destination);

    const start = startTime !== null ? startTime : audioStore.currentTime;
    sourceNode.value.start(0, start);

    audioStore.setPlaying(true);

    // 监听播放结束
    sourceNode.value.onended = () => {
      audioStore.setPlaying(false);
    };

    // 更新当前时间
    const startTimeStamp = ctx.currentTime - start;
    const updateInterval = setInterval(() => {
      if (!audioStore.isPlaying) {
        clearInterval(updateInterval);
        return;
      }
      const newTime = ctx.currentTime - startTimeStamp;
      if (newTime >= audioStore.duration) {
        audioStore.setCurrentTime(audioStore.duration);
        audioStore.setPlaying(false);
        clearInterval(updateInterval);
      } else {
        audioStore.setCurrentTime(newTime);
      }
    }, 100);
  }

  // 暂停播放
  function pause() {
    if (sourceNode.value) {
      sourceNode.value.stop();
      sourceNode.value.disconnect();
      sourceNode.value = null;
    }
    audioStore.setPlaying(false);
  }

  // 跳转到指定时间
  function seek(time) {
    audioStore.setCurrentTime(time);
    if (audioStore.isPlaying) {
      pause();
      play(time);
    }
  }

  // 清理资源
  function dispose() {
    pause();
    if (audioContext.value) {
      audioContext.value.close();
      audioContext.value = null;
    }
  }

  return {
    loadAudio,
    generateWaveformData,
    play,
    pause,
    seek,
    dispose,
  };
}
