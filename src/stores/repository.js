import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useRepositoryStore = defineStore('repository', () => {
  const repositories = ref([])
  const currentRepository = ref(null)
  const loading = ref(false)
  const filters = ref({
    type: 'all',
    search: '',
    sort: 'updated'
  })
  const pagination = ref({
    page: 1,
    perPage: 30,
    total: 0
  })

  const filteredRepositories = computed(() => {
    let result = repositories.value

    // 搜索过滤
    if (filters.value.search) {
      const search = filters.value.search.toLowerCase()
      result = result.filter(repo =>
        repo.name.toLowerCase().includes(search) ||
        (repo.description && repo.description.toLowerCase().includes(search))
      )
    }

    // 类型过滤
    if (filters.value.type !== 'all') {
      if (filters.value.type === 'public') {
        result = result.filter(repo => !repo.private)
      } else if (filters.value.type === 'private') {
        result = result.filter(repo => repo.private)
      } else if (filters.value.type === 'owner') {
        result = result.filter(repo => !repo.fork)
      }
    }

    return result
  })

  // 获取仓库列表
  async function fetchRepositories() {
    loading.value = true
    try {
      const data = await window.electronAPI.api.getRepositories({
        type: filters.value.type,
        sort: filters.value.sort,
        per_page: pagination.value.perPage,
        page: pagination.value.page
      })
      repositories.value = data
      pagination.value.total = data.length
    } catch (error) {
      console.error('Failed to fetch repositories:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 获取单个仓库
  async function fetchRepository(owner, repo) {
    loading.value = true
    try {
      const data = await window.electronAPI.api.getRepository(owner, repo)
      currentRepository.value = data
      return data
    } catch (error) {
      console.error('Failed to fetch repository:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 创建仓库
  async function createRepository(params) {
    try {
      const data = await window.electronAPI.api.createRepository(params)
      repositories.value.unshift(data)
      return data
    } catch (error) {
      console.error('Failed to create repository:', error)
      throw error
    }
  }

  // 更新仓库
  async function updateRepository(owner, repo, params) {
    try {
      const data = await window.electronAPI.api.updateRepository(owner, repo, params)
      const index = repositories.value.findIndex(r => r.full_name === `${owner}/${repo}`)
      if (index !== -1) {
        repositories.value[index] = data
      }
      return data
    } catch (error) {
      console.error('Failed to update repository:', error)
      throw error
    }
  }

  // 删除仓库
  async function deleteRepository(owner, repo) {
    try {
      await window.electronAPI.api.deleteRepository(owner, repo)
      repositories.value = repositories.value.filter(r => r.full_name !== `${owner}/${repo}`)
    } catch (error) {
      console.error('Failed to delete repository:', error)
      throw error
    }
  }

  // 设置过滤器
  function setFilters(newFilters) {
    filters.value = { ...filters.value, ...newFilters }
  }

  return {
    repositories,
    currentRepository,
    loading,
    filters,
    pagination,
    filteredRepositories,
    fetchRepositories,
    fetchRepository,
    createRepository,
    updateRepository,
    deleteRepository,
    setFilters
  }
})
