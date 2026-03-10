import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useSubtitleStore = defineStore('subtitle', () => {
  // State
  const subtitles = ref([]);
  const activeId = ref(null);
  const editingId = ref(null);

  // Getters
  const subtitleCount = computed(() => subtitles.value.length);
  const activeSubtitle = computed(() =>
    subtitles.value.find(s => s.id === activeId.value) || null
  );
  const sortedSubtitles = computed(() =>
    [...subtitles.value].sort((a, b) => a.startTime - b.startTime)
  );

  // 生成唯一ID
  function generateId() {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Actions
  function setSubtitles(newSubtitles) {
    subtitles.value = newSubtitles.map((s, i) => ({ ...s, index: i + 1 }));
  }

  function addSubtitle(subtitle) {
    const id = generateId();
    const newSubtitle = {
      ...subtitle,
      id,
      index: subtitles.value.length + 1,
      isModified: false,
      source: subtitle.source || 'manual',
    };
    subtitles.value.push(newSubtitle);
    reorderSubtitles();
    return newSubtitle;
  }

  function updateSubtitle(id, data) {
    const index = subtitles.value.findIndex(s => s.id === id);
    if (index !== -1) {
      subtitles.value[index] = {
        ...subtitles.value[index],
        ...data,
        isModified: true
      };
    }
  }

  function deleteSubtitle(id) {
    const index = subtitles.value.findIndex(s => s.id === id);
    if (index !== -1) {
      subtitles.value.splice(index, 1);
      reorderSubtitles();
    }
  }

  function setActive(id) {
    activeId.value = id;
  }

  function setEditing(id) {
    editingId.value = id;
  }

  function reorderSubtitles() {
    subtitles.value.sort((a, b) => a.startTime - b.startTime);
    subtitles.value.forEach((s, i) => {
      s.index = i + 1;
    });
  }

  function reset() {
    subtitles.value = [];
    activeId.value = null;
    editingId.value = null;
  }

  return {
    subtitles, activeId, editingId,
    subtitleCount, activeSubtitle, sortedSubtitles,
    setSubtitles, addSubtitle, updateSubtitle, deleteSubtitle,
    setActive, setEditing, reorderSubtitles, reset,
  };
});
