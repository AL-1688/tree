import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginPage.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'Layout',
    component: () => import('@/views/LayoutPage.vue'),
    meta: { requiresAuth: true },
    redirect: '/repositories',
    children: [
      {
        path: 'repositories',
        name: 'Repositories',
        component: () => import('@/views/RepositoriesPage.vue'),
        meta: { title: '我的仓库' }
      },
      {
        path: 'repository/:owner/:repo',
        name: 'RepositoryDetail',
        component: () => import('@/views/RepositoryDetailPage.vue'),
        meta: { title: '仓库详情' }
      },
      {
        path: 'upload',
        name: 'Upload',
        component: () => import('@/views/UploadPage.vue'),
        meta: { title: '文件上传' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/SettingsPage.vue'),
        meta: { title: '设置' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth !== false && !authStore.isAuthenticated) {
    next('/login')
  } else if (to.path === '/login' && authStore.isAuthenticated) {
    next('/')
  } else {
    next()
  }
})

export default router
