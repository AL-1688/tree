import { ref } from 'vue';
import { useDocumentStore } from '../stores/documentStore.js';
import { preprocessDocument, mergeProcessedLines } from '../utils/preprocessDocument.js';

// 动态导入 mammoth
let mammoth = null;
async function getMammoth() {
  if (!mammoth) {
    mammoth = await import('mammoth');
  }
  return mammoth;
}

export function useDocumentParser() {
  const documentStore = useDocumentStore();
  const isParsing = ref(false);

  // 解析文件
  async function parseFile(file) {
    documentStore.setLoading(true);
    documentStore.setError(null);
    isParsing.value = true;

    try {
      let content = '';

      if (file.name.endsWith('.txt')) {
        content = await parseTxtFile(file);
      } else if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
        content = await parseDocxFile(file);
      } else {
        throw new Error('不支持的文件格式');
      }

      documentStore.setDocument(file, content);

      // 如果启用了预处理，自动执行预处理
      if (documentStore.preprocessEnabled) {
        const lines = preprocessDocument(content);
        documentStore.setProcessedLines(lines);
      }

      return content;
    } catch (err) {
      documentStore.setError(`文档解析失败: ${err.message}`);
      throw err;
    } finally {
      documentStore.setLoading(false);
      isParsing.value = false;
    }
  }

  // 解析 TXT 文件
  async function parseTxtFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  }

  // 解析 DOCX 文件
  async function parseDocxFile(file) {
    const mammothLib = await getMammoth();
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammothLib.extractRawText({ arrayBuffer });
    return result.value;
  }

  // 执行预处理
  function doPreprocess(text) {
    const lines = preprocessDocument(text);
    documentStore.setProcessedLines(lines);
    return lines;
  }

  // 切换预处理开关
  function togglePreprocess(enabled) {
    documentStore.togglePreprocess(enabled);

    if (enabled && documentStore.rawContent) {
      const lines = preprocessDocument(documentStore.rawContent);
      documentStore.setProcessedLines(lines);
    }
  }

  // 获取用于对齐的内容
  function getAlignContent() {
    if (documentStore.preprocessEnabled && documentStore.processedLines.length > 0) {
      return mergeProcessedLines(documentStore.processedLines);
    }
    return documentStore.rawContent;
  }

  return {
    isParsing,
    parseFile,
    doPreprocess,
    togglePreprocess,
    getAlignContent,
  };
}
