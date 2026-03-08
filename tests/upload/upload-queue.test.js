import { describe, it, expect, beforeEach } from 'vitest'
import UploadQueue from '../../electron/upload/upload-queue'

describe('UploadQueue', () => {
  let queue

  beforeEach(() => {
    queue = new UploadQueue()
  })

  describe('enqueue', () => {
    it('should add items to the queue', () => {
      const items = [
        { path: 'file1.txt', localPath: '/path/file1.txt', size: 100, status: 'pending' },
        { path: 'file2.txt', localPath: '/path/file2.txt', size: 200, status: 'pending' }
      ]

      queue.enqueue(items)

      expect(queue.items.length).toBe(2)
    })

    it('should sort items by priority', () => {
      const items = [
        { path: 'file1.txt', localPath: '/path/file1.txt', size: 100, status: 'pending' },
        { path: 'file2.txt', localPath: '/path/file2.txt', size: 200, status: 'pending' }
      ]

      // Add items with different priorities
      queue.enqueue([items[0]], 0)  // priority 0
      queue.enqueue([items[1]], 1)  // priority 1

      const first = queue.dequeue()
      expect(first.path).toBe('file2.txt')
    })
  })

  describe('dequeue', () => {
    it('should return null when queue is empty', () => {
      expect(queue.dequeue()).toBeNull()
    })

    it('should return null when no pending items', () => {
      queue.items = [{ path: 'file1.txt', status: 'completed' }]
      expect(queue.dequeue()).toBeNull()
    })

    it('should return and update item status to uploading', () => {
      queue.enqueue([
        { path: 'file1.txt', localPath: '/path/file1.txt', size: 100, status: 'pending' }
      ])

      const item = queue.dequeue()
      expect(item.path).toBe('file1.txt')
      expect(item.status).toBe('uploading')
    })
  })

  describe('markCompleted', () => {
    it('should mark item as completed', () => {
      queue.enqueue([
        { path: 'file1.txt', localPath: '/path/file1.txt', size: 100, status: 'pending' }
      ])

      queue.dequeue()
      queue.markCompleted('file1.txt', 'abc123')

      const status = queue.getStatus()
      expect(status.completed).toBe(1)

      const item = queue.items.find(i => i.path === 'file1.txt')
      expect(item.sha).toBe('abc123')
    })
  })

  describe('markFailed', () => {
    it('should mark item as failed', () => {
      queue.enqueue([
        { path: 'file1.txt', localPath: '/path/file1.txt', size: 100, status: 'pending' }
      ])

      queue.dequeue()
      queue.markFailed('file1.txt', 'Network error')

      const status = queue.getStatus()
      expect(status.failed).toBe(1)

      const item = queue.items.find(i => i.path === 'file1.txt')
      expect(item.error).toBe('Network error')
    })
  })

  describe('requeueFailed', () => {
    it('should requeue failed items', () => {
      queue.enqueue([
        { path: 'file1.txt', localPath: '/path/file1.txt', size: 100, status: 'pending' }
      ])

      queue.dequeue()
      queue.markFailed('file1.txt', 'Network error')
      queue.requeueFailed(['file1.txt'])

      const status = queue.getStatus()
      expect(status.pending).toBe(1)
    })
  })

  describe('getStatus', () => {
    it('should return correct status', () => {
      queue.enqueue([
        { path: 'file1.txt', localPath: '/path/file1.txt', size: 100, status: 'pending' },
        { path: 'file2.txt', localPath: '/path/file2.txt', size: 200, status: 'pending' }
      ])

      queue.dequeue()
      queue.markCompleted('file1.txt')

      const status = queue.getStatus()
      expect(status.total).toBe(2)
      expect(status.pending).toBe(1)
      expect(status.completed).toBe(1)
      expect(status.uploading).toBe(0)
    })
  })

  describe('clear', () => {
    it('should clear the queue', () => {
      queue.enqueue([
        { path: 'file1.txt', localPath: '/path/file1.txt', size: 100, status: 'pending' }
      ])

      queue.clear()

      expect(queue.items.length).toBe(0)
    })
  })

  describe('getStats', () => {
    it('should return correct statistics', () => {
      queue.enqueue([
        { path: 'file1.txt', localPath: '/path/file1.txt', size: 100, status: 'pending' },
        { path: 'file2.txt', localPath: '/path/file2.txt', size: 200, status: 'pending' }
      ])

      queue.dequeue()
      queue.markCompleted('file1.txt')

      const stats = queue.getStats()
      expect(stats.totalFiles).toBe(2)
      expect(stats.totalSize).toBe(300)
      expect(stats.completedFiles).toBe(1)
      expect(stats.completedSize).toBe(100)
    })
  })

  describe('export and import', () => {
    it('should export and import queue state', () => {
      queue.enqueue([
        { path: 'file1.txt', localPath: '/path/file1.txt', size: 100, status: 'pending' }
      ])

      const exported = queue.export()
      expect(exported.length).toBe(1)
      expect(exported[0].path).toBe('file1.txt')

      const newQueue = new UploadQueue()
      newQueue.import(exported)
      expect(newQueue.items.length).toBe(1)
      expect(newQueue.items[0].path).toBe('file1.txt')
    })
  })
})
