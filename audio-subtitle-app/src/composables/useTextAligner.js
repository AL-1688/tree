import { ref } from 'vue';
import { useSubtitleStore } from '../stores/subtitleStore.js';
import { useTranscriptStore } from '../stores/transcriptStore.js';
import { removePunctuation } from '../utils/preprocessDocument.js';

export function useTextAligner() {
  const subtitleStore = useSubtitleStore();
  const transcriptStore = useTranscriptStore();

  const isAligning = ref(false);
  const alignResult = ref(null);

  // 执行文本对齐
  function align(documentText) {
    isAligning.value = true;
    alignResult.value = null;

    try {
      const chunks = transcriptStore.chunks;
      if (!chunks || chunks.length === 0) {
        throw new Error('没有识别结果可供对齐');
      }

      // 移除文档文本中的标点符号
      const cleanDocumentText = removePunctuation(documentText);

      // 合并识别文本
      const recognizedText = chunks.map(c => removePunctuation(c.text)).join('');

      // 计算对齐
      const alignedSubtitles = doAlign(chunks, cleanDocumentText, recognizedText);

      // 更新字幕
      subtitleStore.setSubtitles(alignedSubtitles);

      alignResult.value = {
        subtitles: alignedSubtitles,
        diffCount: calculateDiffCount(recognizedText, cleanDocumentText),
      };

      return alignResult.value;
    } catch (err) {
      throw err;
    } finally {
      isAligning.value = false;
    }
  }

  // 执行对齐算法
  function doAlign(chunks, documentText, recognizedText) {
    const aligned = [];
    let docIndex = 0;
    let recIndex = 0;

    for (const chunk of chunks) {
      const chunkText = removePunctuation(chunk.text);
      const chunkLength = chunkText.length;

      // 从文档中提取对应长度的文本
      let alignedText = '';
      let remainingLength = chunkLength;

      while (remainingLength > 0 && docIndex < documentText.length) {
        alignedText += documentText[docIndex];
        docIndex++;
        remainingLength--;
      }

      // 生成字幕ID
      const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      aligned.push({
        id,
        index: aligned.length + 1,
        startTime: chunk.start,
        endTime: chunk.end,
        text: alignedText,
        isModified: alignedText !== chunkText,
        source: 'aligned',
      });
    }

    return aligned;
  }

  // 计算差异数量
  function calculateDiffCount(text1, text2) {
    return Math.abs(text1.length - text2.length);
  }

  // 高亮差异
  function highlightDifferences(original, aligned) {
    const diffs = [];
    const maxLen = Math.max(original.length, aligned.length);

    for (let i = 0; i < maxLen; i++) {
      const origChar = original[i] || '';
      const alignChar = aligned[i] || '';

      if (origChar !== alignChar) {
        diffs.push({
          position: i,
          original: origChar,
          aligned: alignChar,
          type: !origChar ? 'add' : !alignChar ? 'delete' : 'modify',
        });
      }
    }

    return diffs;
  }

  return {
    isAligning,
    alignResult,
    align,
    highlightDifferences,
  };
}
