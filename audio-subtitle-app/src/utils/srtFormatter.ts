/**
 * SRT 格式化工具
 */

import { formatTime } from './timeUtils';
import type { Subtitle } from '../stores/subtitleStore';

/**
 * 格式化单个字幕条目为 SRT 格式
 */
export function formatSubtitleToSRT(subtitle: Subtitle, index: number): string {
  const startTime = formatTime(subtitle.startTime);
  const endTime = formatTime(subtitle.endTime);

  return `${index + 1}\n${startTime} --> ${endTime}\n${subtitle.text}\n`;
}

/**
 * 格式化字幕列表为 SRT 文件内容
 */
export function formatToSRT(subtitles: Subtitle[]): string {
  return subtitles
    .sort((a, b) => a.startTime - b.startTime)
    .map((subtitle, index) => formatSubtitleToSRT(subtitle, index))
    .join('\n');
}

/**
 * 导出 SRT 文件
 */
export function exportSRT(subtitles: Subtitle[], filename: string = 'subtitles.srt'): void {
  const content = formatToSRT(subtitles);
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
