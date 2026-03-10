/**
 * 文档预处理工具
 */

/**
 * 定义需要删除的中文标点符号
 */
const PUNCTUATION_REGEX = /[，。？！；：""''、]/g;

/**
 * 文档预处理：删除标点符号并换行
 * @param text 原始文档文本
 * @returns 处理后的文本行数组
 */
export function preprocessDocument(text: string): string[] {
  // 1. 在标点符号位置插入换行符
  const processedText = text.replace(PUNCTUATION_REGEX, '\n');

  // 2. 按换行符分割
  // 3. 去除首尾空白
  // 4. 过滤空行
  const lines = processedText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  return lines;
}

/**
 * 预处理后重新合并文本（用于对齐）
 * @param lines 预处理后的文本行数组
 * @returns 合并后的文本（无标点）
 */
export function mergeProcessedLines(lines: string[]): string {
  return lines.join('');
}

/**
 * 移除文本中的所有标点符号（不换行）
 * @param text 原始文本
 * @returns 无标点的文本
 */
export function removePunctuation(text: string): string {
  return text.replace(PUNCTUATION_REGEX, '');
}

/**
 * 检测文本是否包含中文标点
 * @param text 文本
 * @returns 是否包含中文标点
 */
export function hasPunctuation(text: string): boolean {
  return PUNCTUATION_REGEX.test(text);
}

/**
 * 统计文本中的标点符号数量
 * @param text 文本
 * @returns 标点符号数量
 */
export function countPunctuation(text: string): number {
  const matches = text.match(PUNCTUATION_REGEX);
  return matches ? matches.length : 0;
}
