import { formatTime } from './timeUtils.js';

/**
 * 格式化单个字幕为 SRT 格式
 */
export function formatSubtitleToSRT(subtitle, index) {
  const startTime = formatTime(subtitle.startTime);
  const endTime = formatTime(subtitle.endTime);
  return `${index + 1}\n${startTime} --> ${endTime}\n${subtitle.text}\n`;
}

/**
 * 格式化字幕列表为 SRT 文件内容
 */
export function formatToSRT(subtitles) {
  return subtitles
    .map((subtitle, index) => formatSubtitleToSRT(subtitle, index))
    .join('\n');
}

/**
 * 下载 SRT 文件
 */
export function downloadSRT(subtitles, filename = 'subtitle.srt') {
  const content = formatToSRT(subtitles);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
