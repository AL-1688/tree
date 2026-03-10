import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useDocumentStore = defineStore('document', () => {
  // State
  const file = ref(null);
  const rawContent = ref('');
  const processedLines = ref([]);
  const preprocessEnabled = ref(true);
  const isLoading = ref(false);
  const error = ref(null);

  // Getters
  const hasDocument = computed(() => rawContent.value.length > 0);
  const content = computed(() => {
    if (preprocessEnabled.value && processedLines.value.length > 0) {
      return processedLines.value.join('');
    }
    return rawContent.value;
  });

  // Actions
  function setDocument(docFile, content) {
    file.value = docFile;
    rawContent.value = content;
    processedLines.value = [];
  }

  function setProcessedLines(lines) {
    processedLines.value = lines;
  }

  function togglePreprocess(enabled) {
    preprocessEnabled.value = enabled;
  }

  function setLoading(loading) {
    isLoading.value = loading;
  }

  function setError(err) {
    error.value = err;
  }

  function reset() {
    file.value = null;
    rawContent.value = '';
    processedLines.value = [];
    preprocessEnabled.value = true;
    isLoading.value = false;
    error.value = null;
  }

  return {
    file, rawContent, processedLines, preprocessEnabled, isLoading, error,
    hasDocument, content,
    setDocument, setProcessedLines, togglePreprocess, setLoading, setError, reset,
  };
});
