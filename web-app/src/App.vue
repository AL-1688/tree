<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

onMounted(() => {
  // 尝试从 localStorage 恢复登录状态
  authStore.initAuth()
})
</script>

<style>
#app {
  width: 100%;
  height: 100vh;
}
</style>
