import { formatPlayTime } from './timeUtils.js';

/**
 * 格式化字幕列表为 TXT 文件内容
 */
export function formatToTXT(subtitles) {
  return subtitles
    .map((subtitle, index) => {
      const startTime = formatPlayTime(subtitle.startTime);
      const endTime = formatPlayTime(subtitle.endTime);
      return `[${startTime}-${endTime}] ${subtitle.text}`;
    })
    .join('\n');
}

/**
 * 下载 TXT 文件
 */
export function downloadTXT(subtitles, filename = 'subtitle.txt') {
  const content = formatToTXT(subtitles);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
