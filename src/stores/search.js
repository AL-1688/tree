import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSearchStore = defineStore('search', () => {
  const query = ref('')
  const filters = ref({
    language: '',
    stars: '',
    sort: 'best-match'
  })
  const results = ref([])
  const loading = ref(false)
  const pagination = ref({
    page: 1,
    perPage: 30,
    total: 0
  })

  // 搜索仓库
  async function searchRepositories(searchQuery) {
    if (searchQuery) {
      query.value = searchQuery
    }

    if (!query.value) {
      return
    }

    loading.value = true
    try {
      // 构建搜索查询
      let q = query.value

      if (filters.value.language) {
        q += ` language:${filters.value.language}`
      }

      if (filters.value.stars) {
        q += ` stars:${filters.value.stars}`
      }

      const data = await window.electronAPI.api.searchRepositories({
        q,
        sort: filters.value.sort,
        per_page: pagination.value.perPage,
        page: pagination.value.page
      })

      results.value = data.items || []
      pagination.value.total = data.total_count || 0
    } catch (error) {
      console.error('Failed to search repositories:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // Fork 仓库
  async function forkRepository(owner, repo) {
    try {
      const result = await window.electronAPI.api.forkRepository(owner, repo)
      return result
    } catch (error) {
      console.error('Failed to fork repository:', error)
      throw error
    }
  }

  // 设置过滤器
  function setFilters(newFilters) {
    filters.value = { ...filters.value, ...newFilters }
  }

  // 重置搜索
  function resetSearch() {
    query.value = ''
    results.value = []
    pagination.value = {
      page: 1,
      perPage: 30,
      total: 0
    }
  }

  return {
    query,
    filters,
    results,
    loading,
    pagination,
    searchRepositories,
    forkRepository,
    setFilters,
    resetSearch
  }
})
