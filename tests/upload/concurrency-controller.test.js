import { describe, it, expect, beforeEach, vi } from 'vitest'
import ConcurrencyController from '../../electron/upload/concurrency-controller'

describe('ConcurrencyController', () => {
  let controller

  beforeEach(() => {
    controller = new ConcurrencyController(3)
  })

  describe('acquireSlot', () => {
    it('should return a slot ID when slots are available', async () => {
      const slotId = await controller.acquireSlot()
      expect(slotId).toBe(1)
      expect(controller.currentConcurrency).toBe(1)
    })

    it('should return different slot IDs for multiple acquisitions', async () => {
      const id1 = await controller.acquireSlot()
      const id2 = await controller.acquireSlot()
      const id3 = await controller.acquireSlot()

      expect(id1).toBe(1)
      expect(id2).toBe(2)
      expect(id3).toBe(3)
      expect(controller.currentConcurrency).toBe(3)
    })

    it('should wait when max concurrency reached', async () => {
      // Acquire all 3 slots
      const slots = await Promise.all([
        controller.acquireSlot(),
        controller.acquireSlot(),
        controller.acquireSlot()
      ])

      expect(controller.currentConcurrency).toBe(3)
      expect(controller.getStatus().availableSlots).toBe(0)

      // Start another acquisition that should wait
      let slot4Acquired = false
      const acquirePromise = controller.acquireSlot().then(id => {
        slot4Acquired = true
        return id
      })

      // Give some time to verify it's waiting
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(slot4Acquired).toBe(false)

      // Release a slot
      controller.releaseSlot(slots[0], true, 100)

      // Now the waiting acquisition should complete
      const slot4 = await acquirePromise
      expect(slot4).toBe(4)
      expect(slot4Acquired).toBe(true)
    })
  })

  describe('releaseSlot', () => {
    it('should decrease current concurrency', async () => {
      const slotId = await controller.acquireSlot()
      expect(controller.currentConcurrency).toBe(1)

      controller.releaseSlot(slotId, true, 100)
      expect(controller.currentConcurrency).toBe(0)
    })

    it('should record response time', async () => {
      const slotId = await controller.acquireSlot()
      controller.releaseSlot(slotId, true, 500)

      expect(controller.responseTimes).toContain(500)
      expect(controller.getAverageResponseTime()).toBe(500)
    })

    it('should track success count', async () => {
      const slotId = await controller.acquireSlot()
      controller.releaseSlot(slotId, true, 100)

      expect(controller.successCount).toBe(1)
      expect(controller.errorCount).toBe(0)
    })

    it('should track error count', async () => {
      const slotId = await controller.acquireSlot()
      controller.releaseSlot(slotId, false, 100)

      expect(controller.errorCount).toBe(1)
      expect(controller.successCount).toBe(0)
    })

    it('should reset error count on success', async () => {
      const slotId1 = await controller.acquireSlot()
      controller.releaseSlot(slotId1, false, 100)
      expect(controller.errorCount).toBe(1)

      const slotId2 = await controller.acquireSlot()
      controller.releaseSlot(slotId2, true, 100)
      expect(controller.errorCount).toBe(0)
    })
  })

  describe('setMaxConcurrency', () => {
    it('should set max concurrency within bounds', () => {
      controller.setMaxConcurrency(5)
      expect(controller.maxConcurrency).toBe(5)
    })

    it('should not set below minimum', () => {
      controller.setMaxConcurrency(0)
      expect(controller.maxConcurrency).toBe(1)
    })

    it('should not set above maximum', () => {
      controller.setMaxConcurrency(20)
      expect(controller.maxConcurrency).toBe(10)
    })
  })

  describe('auto adjust', () => {
    it('should reduce concurrency on consecutive errors', async () => {
      controller.setAutoAdjust(true)
      expect(controller.maxConcurrency).toBe(3)

      // Trigger 3 consecutive errors
      for (let i = 0; i < 3; i++) {
        const slotId = await controller.acquireSlot()
        controller.releaseSlot(slotId, false, 100)
      }

      expect(controller.maxConcurrency).toBe(2)
    })

    it('should recover concurrency on consecutive successes', async () => {
      controller.setAutoAdjust(true)
      controller.maxConcurrency = 2  // Start from lower value

      // Trigger 5 consecutive successes
      for (let i = 0; i < 5; i++) {
        const slotId = await controller.acquireSlot()
        controller.releaseSlot(slotId, true, 100)
      }

      expect(controller.maxConcurrency).toBe(3)
    })

    it('should not adjust when auto adjust disabled', async () => {
      controller.setAutoAdjust(false)
      controller.maxConcurrency = 2

      // Trigger errors
      for (let i = 0; i < 5; i++) {
        const slotId = await controller.acquireSlot()
        controller.releaseSlot(slotId, false, 100)
      }

      expect(controller.maxConcurrency).toBe(2)
    })
  })

  describe('getAverageResponseTime', () => {
    it('should return 0 when no response times', () => {
      expect(controller.getAverageResponseTime()).toBe(0)
    })

    it('should calculate average correctly', async () => {
      const slotId1 = await controller.acquireSlot()
      controller.releaseSlot(slotId1, true, 100)

      const slotId2 = await controller.acquireSlot()
      controller.releaseSlot(slotId2, true, 200)

      const slotId3 = await controller.acquireSlot()
      controller.releaseSlot(slotId3, true, 300)

      expect(controller.getAverageResponseTime()).toBe(200)
    })

    it('should only keep last N response times', async () => {
      // Add more than responseTimeWindow (10) entries
      for (let i = 0; i < 15; i++) {
        const slotId = await controller.acquireSlot()
        controller.releaseSlot(slotId, true, i * 100)
      }

      expect(controller.responseTimes.length).toBe(10)
    })
  })

  describe('getStatus', () => {
    it('should return correct status', async () => {
      await controller.acquireSlot()
      await controller.acquireSlot()

      const status = controller.getStatus()

      expect(status.maxConcurrency).toBe(3)
      expect(status.currentConcurrency).toBe(2)
      expect(status.availableSlots).toBe(1)
      expect(status.autoAdjustEnabled).toBe(true)
    })
  })

  describe('getErrorRate', () => {
    it('should return 0 when no operations', () => {
      expect(controller.getErrorRate()).toBe(0)
    })

    it('should calculate error rate correctly', async () => {
      // 2 successes, 1 failure
      const slotId1 = await controller.acquireSlot()
      controller.releaseSlot(slotId1, true, 100)

      const slotId2 = await controller.acquireSlot()
      controller.releaseSlot(slotId2, true, 100)

      const slotId3 = await controller.acquireSlot()
      controller.releaseSlot(slotId3, false, 100)

      // Note: getErrorRate uses current errorCount and successCount
      // After the last failure, successCount is reset
      expect(controller.getErrorRate()).toBe(1)  // 1 error, 0 success after reset
    })
  })

  describe('reset', () => {
    it('should reset statistics', async () => {
      const slotId = await controller.acquireSlot()
      controller.releaseSlot(slotId, true, 100)

      controller.reset()

      expect(controller.responseTimes).toEqual([])
      expect(controller.errorCount).toBe(0)
      expect(controller.successCount).toBe(0)
    })
  })
})
