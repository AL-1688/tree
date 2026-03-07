import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/repository/:owner/:repo',
    name: 'Repository',
    component: () => import('../views/RepositoryDetail.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/repository/:owner/:repo/settings',
    name: 'RepositorySettings',
    component: () => import('../views/RepositorySettings.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/repository/:owner/:repo/browse/*',
    name: 'FileBrowser',
    component: () => import('../views/FileBrowser.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/repository/:owner/:repo/edit/*',
    name: 'FileEditor',
    component: () => import('../views/FileEditor.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/search',
    name: 'Search',
    component: () => import('../views/SearchPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/')
  } else {
    next()
  }
})

export default router
