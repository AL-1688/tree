import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAudioStore = defineStore('audio', () => {
  // State
  const file = ref(null);
  const audioBuffer = ref(null);
  const duration = ref(0);
  const currentTime = ref(0);
  const isPlaying = ref(false);
  const waveformData = ref(null);
  const isLoading = ref(false);
  const error = ref(null);

  // Getters
  const hasAudio = computed(() => audioBuffer.value !== null);
  const progress = computed(() => {
    if (duration.value === 0) return 0;
    return (currentTime.value / duration.value) * 100;
  });

  // Actions
  function setAudio(audioFile, buffer) {
    file.value = audioFile;
    audioBuffer.value = buffer;
    duration.value = buffer.duration;
    currentTime.value = 0;
    isPlaying.value = false;
  }

  function setCurrentTime(time) {
    currentTime.value = Math.max(0, Math.min(time, duration.value));
  }

  function setPlaying(playing) {
    isPlaying.value = playing;
  }

  function setWaveformData(data) {
    waveformData.value = data;
  }

  function setLoading(loading) {
    isLoading.value = loading;
  }

  function setError(err) {
    error.value = err;
  }

  function reset() {
    file.value = null;
    audioBuffer.value = null;
    duration.value = 0;
    currentTime.value = 0;
    isPlaying.value = false;
    waveformData.value = null;
    isLoading.value = false;
    error.value = null;
  }

  return {
    file, audioBuffer, duration, currentTime, isPlaying, waveformData, isLoading, error,
    hasAudio, progress,
    setAudio, setCurrentTime, setPlaying, setWaveformData, setLoading, setError, reset,
  };
});
