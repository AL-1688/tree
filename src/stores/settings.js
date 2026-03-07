import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref('light')
  const defaultBranch = ref('main')
  const maxConcurrency = ref(5)

  // 初始化设置
  async function init() {
    try {
      const savedTheme = await window.electronAPI.storage.get('theme')
      if (savedTheme) {
        theme.value = savedTheme
      }

      const savedBranch = await window.electronAPI.storage.get('defaultBranch')
      if (savedBranch) {
        defaultBranch.value = savedBranch
      }

      const savedConcurrency = await window.electronAPI.storage.get('maxConcurrency')
      if (savedConcurrency) {
        maxConcurrency.value = savedConcurrency
      }
    } catch (error) {
      console.error('Failed to init settings:', error)
    }
  }

  // 更新主题
  async function setTheme(newTheme) {
    theme.value = newTheme
    await window.electronAPI.storage.set('theme', newTheme)
  }

  // 更新默认分支
  async function setDefaultBranch(branch) {
    defaultBranch.value = branch
    await window.electronAPI.storage.set('defaultBranch', branch)
  }

  // 更新并发数
  async function setMaxConcurrency(count) {
    maxConcurrency.value = count
    await window.electronAPI.storage.set('maxConcurrency', count)
  }

  return {
    theme,
    defaultBranch,
    maxConcurrency,
    init,
    setTheme,
    setDefaultBranch,
    setMaxConcurrency
  }
})
