// 格式化时间为 SRT 格式 (HH:MM:SS,mmm)
export function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

function pad(num, size) {
  return num.toString().padStart(size, '0');
}

// 格式化播放时间（MM:SS）
export function formatPlayTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${pad(m, 2)}:${pad(s, 2)}`;
}
