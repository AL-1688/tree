/**
 * 时间工具函数
 */

/**
 * 格式化时间为 SRT 格式 (HH:MM:SS,mmm)
 * @param seconds 秒数
 * @returns SRT 格式时间字符串
 */
export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

/**
 * 格式化播放时间 (MM:SS)
 * @param seconds 秒数
 * @returns 播放时间字符串
 */
export function formatPlayTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${pad(m, 2)}:${pad(s, 2)}`;
}

/**
 * 格式化时间为可读格式 (HH:MM:SS.mmm)
 * @param seconds 秒数
 * @returns 可读时间字符串
 */
export function formatTimeReadable(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  if (h > 0) {
    return `${h}:${pad(m, 2)}:${pad(s, 2)}.${pad(ms, 3)}`;
  }
  return `${m}:${pad(s, 2)}.${pad(ms, 3)}`;
}

/**
 * 解析 SRT 时间格式
 * @param timeStr SRT 格式时间字符串
 * @returns 秒数
 */
export function parseTime(timeStr: string): number {
  const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
  if (!match) return 0;

  const [, hours, minutes, seconds, ms] = match;
  return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(ms) / 1000;
}

/**
 * 解析播放时间格式 (MM:SS)
 * @param timeStr 播放时间字符串
 * @returns 秒数
 */
export function parsePlayTime(timeStr: string): number {
  const match = timeStr.match(/(\d+):(\d+)/);
  if (!match) return 0;

  const [, minutes, seconds] = match;
  return parseInt(minutes) * 60 + parseInt(seconds);
}

/**
 * 辅助函数：数字补零
 */
function pad(num: number, size: number): string {
  return num.toString().padStart(size, '0');
}
