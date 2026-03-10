/**
 * 文档预处理：删除标点符号并换行
 * @param text 原始文档文本
 * @returns 处理后的文本行数组
 */
export function preprocessDocument(text) {
  // 定义需要删除的标点符号（中文标点）
  const punctuationRegex = /[，。？！]/g;

  // 在标点符号位置插入换行符，然后删除标点符号
  const processedText = text.replace(punctuationRegex, '\n');

  // 按换行符分割，过滤空行
  const lines = processedText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  return lines;
}

/**
 * 预处理后重新合并文本（用于对齐）
 */
export function mergeProcessedLines(lines) {
  return lines.join('');
}
