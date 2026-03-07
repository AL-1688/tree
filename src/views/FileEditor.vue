<template>
  <div class="file-editor">
    <header class="editor-header">
      <div class="header-left">
        <button @click="goBack" class="back-btn">
          <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
            <path d="M7.78 12.53a.75.75 0 01-1.06 0L2.47 8.28a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 1.06L4.81 7h7.44a.75.75 0 010 1.5H4.81l2.97 2.97a.75.75 0 010 1.06z"></path>
          </svg>
        </button>
        <h2>{{ fileName }}</h2>
        <span v-if="hasChanges" class="unsaved-badge">未保存</span>
      </div>
      <div class="header-right">
        <button @click="saveFile" class="btn-primary" :disabled="saving || !hasChanges">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </header>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>加载文件...</p>
    </div>

    <div v-else class="editor-container">
      <div class="line-numbers">
        <div v-for="line in lineCount" :key="line" class="line-number">
          {{ line }}
        </div>
      </div>
      <textarea
        v-model="content"
        class="editor-textarea"
        spellcheck="false"
        @input="handleInput"
        @scroll="syncScroll"
        ref="editorRef"
      ></textarea>
    </div>

    <!-- 提交信息对话框 -->
    <div v-if="showCommitDialog" class="dialog-overlay" @click="showCommitDialog = false">
      <div class="dialog" @click.stop>
        <h2>提交更改</h2>
        <div class="form-group">
          <label>提交信息</label>
          <input
            v-model="commitMessage"
            type="text"
            placeholder="描述你的更改..."
            @keyup.enter="confirmSave"
          />
        </div>
        <div class="form-actions">
          <button @click="showCommitDialog = false" class="btn-secondary">取消</button>
          <button @click="confirmSave" class="btn-primary" :disabled="saving">
            {{ saving ? '保存中...' : '提交' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const content = ref('')
const originalContent = ref('')
const loading = ref(false)
const saving = ref(false)
const showCommitDialog = ref(false)
const commitMessage = ref('')
const editorRef = ref(null)
const fileSha = ref('')

const fileName = computed(() => {
  const path = route.params.pathMatch || ''
  const parts = Array.isArray(path) ? path : path.split('/')
  return parts[parts.length - 1] || '文件'
})

const hasChanges = computed(() => content.value !== originalContent.value)

const lineCount = computed(() => {
  return content.value.split('\n').length
})

onMounted(async () => {
  await loadFile()
})

async function loadFile() {
  loading.value = true
  try {
    const { owner, repo } = route.params
    const path = route.params.pathMatch || ''

    // 获取文件内容和 SHA
    const fileData = await window.electronAPI.api.getRepositoryContent({
      owner,
      repo,
      path: Array.isArray(path) ? path.join('/') : path
    })

    if (fileData.type === 'file') {
      fileSha.value = fileData.sha
      const fileContent = await window.electronAPI.api.getFileContent({
        owner,
        repo,
        path: Array.isArray(path) ? path.join('/') : path
      })
      content.value = fileContent
      originalContent.value = fileContent
    }
  } catch (error) {
    console.error('Failed to load file:', error)
    alert('加载文件失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

function handleInput() {
  // 自动调整行号滚动
}

function syncScroll() {
  const editor = editorRef.value
  if (editor) {
    const lineNumbers = document.querySelector('.line-numbers')
    if (lineNumbers) {
      lineNumbers.scrollTop = editor.scrollTop
    }
  }
}

function saveFile() {
  if (!hasChanges.value) return
  showCommitDialog.value = true
  commitMessage.value = `Update ${fileName.value}`
}

async function confirmSave() {
  if (!commitMessage.value.trim()) {
    alert('请输入提交信息')
    return
  }

  saving.value = true
  try {
    const { owner, repo } = route.params
    const path = route.params.pathMatch || ''

    await window.electronAPI.api.updateFile({
      owner,
      repo,
      path: Array.isArray(path) ? path.join('/') : path,
      content: content.value,
      message: commitMessage.value,
      sha: fileSha.value
    })

    originalContent.value = content.value
    showCommitDialog.value = false
    alert('文件已保存')
  } catch (error) {
    console.error('Failed to save file:', error)
    alert('保存失败: ' + error.message)
  } finally {
    saving.value = false
  }
}

function goBack() {
  if (hasChanges.value) {
    if (!confirm('有未保存的更改,确定要离开吗?')) {
      return
    }
  }
  router.back()
}
</script>

<style scoped>
.file-editor {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: var(--card-bg);
  border-bottom: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.back-btn:hover {
  background: var(--border-color);
}

.editor-header h2 {
  font-size: 18px;
  color: var(--text-color);
}

.unsaved-badge {
  padding: 4px 10px;
  background: #fff3e0;
  color: #e65100;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--text-color);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.editor-container {
  flex: 1;
  display: flex;
  overflow: hidden;
  background: var(--card-bg);
}

.line-numbers {
  width: 50px;
  background: var(--bg-color);
  border-right: 1px solid var(--border-color);
  overflow-y: hidden;
  padding: 16px 0;
  text-align: right;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 14px;
  line-height: 1.6;
  color: #95a5a6;
  user-select: none;
}

.line-number {
  padding: 0 12px;
}

.editor-textarea {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  padding: 16px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 14px;
  line-height: 1.6;
  background: var(--card-bg);
  color: var(--text-color);
}

/* 对话框样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 32px;
  width: 100%;
  max-width: 480px;
}

.dialog h2 {
  font-size: 24px;
  color: var(--text-color);
  margin-bottom: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
  margin-bottom: 8px;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 15px;
  background: var(--card-bg);
  color: var(--text-color);
}

.form-group input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-primary {
  padding: 10px 20px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 10px 20px;
  background: transparent;
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: var(--border-color);
}
</style>
