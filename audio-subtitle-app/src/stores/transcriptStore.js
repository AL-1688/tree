import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useTranscriptStore = defineStore('transcript', () => {
  // State
  const rawText = ref('');
  const chunks = ref([]);
  const language = ref('');
  const model = ref('');
  const timestamp = ref(0);
  const isTranscribing = ref(false);
  const progress = ref(0);
  const error = ref(null);

  // Getters
  const hasTranscript = computed(() => chunks.value.length > 0);

  // Actions
  function setTranscript(result) {
    rawText.value = result.text;
    chunks.value = result.chunks || [];
    language.value = result.language || '';
    model.value = result.model || '';
    timestamp.value = Date.now();
  }

  function setTranscribing(value) {
    isTranscribing.value = value;
  }

  function setProgress(value) {
    progress.value = value;
  }

  function setError(err) {
    error.value = err;
  }

  function reset() {
    rawText.value = '';
    chunks.value = [];
    language.value = '';
    model.value = '';
    timestamp.value = 0;
    isTranscribing.value = false;
    progress.value = 0;
    error.value = null;
  }

  return {
    rawText, chunks, language, model, timestamp,
    isTranscribing, progress, error,
    hasTranscript,
    setTranscript, setTranscribing, setProgress, setError, reset,
  };
});
