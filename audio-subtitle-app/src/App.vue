<template>
  <div class="app-container">
    <HomeView />
  </div>
</template>

<script setup>
import HomeView from './views/HomeView.vue';
</script>

<style>
.app-container {
  min-height: 100vh;
  background-color: var(--bg-color, #f5f7fa);
}
</style>
