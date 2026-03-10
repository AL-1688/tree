/**
 * TXT 格式化工具
 */

import type { Subtitle } from '../stores/subtitleStore';
import { formatTimeReadable } from './timeUtils';

/**
 * 格式化字幕列表为 TXT 文件内容（带时间戳）
 */
export function formatToTXT(subtitles: Subtitle[], includeTimestamps: boolean = true): string {
  return subtitles
    .sort((a, b) => a.startTime - b.startTime)
    .map(subtitle => {
      if (includeTimestamps) {
        const start = formatTimeReadable(subtitle.startTime);
        const end = formatTimeReadable(subtitle.endTime);
        return `[${start} - ${end}] ${subtitle.text}`;
      }
      return subtitle.text;
    })
    .join('\n');
}

/**
 * 导出 TXT 文件
 */
export function exportTXT(
  subtitles: Subtitle[],
  filename: string = 'subtitles.txt',
  includeTimestamps: boolean = true
): void {
  const content = formatToTXT(subtitles, includeTimestamps);
  downloadFile(content, filename, 'text/plain;charset=utf-8');
}

/**
 * 下载文件辅助函数
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
