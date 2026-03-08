/**
 * 并发控制器
 * 控制上传并发数量，支持自适应调整
 */

class ConcurrencyController {
  constructor(maxConcurrency = 3) {
    this.maxConcurrency = maxConcurrency
    this.currentConcurrency = 0
    this.activeSlots = new Map()
    this.responseTimes = []
    this.errorCount = 0
    this.successCount = 0
    this.autoAdjustEnabled = true
    this.slotIdCounter = 0

    // 自适应调整参数
    this.minConcurrency = 1
    this.maxAllowedConcurrency = 10
    this.responseTimeWindow = 10  // 保留最近 10 次响应时间
    this.slowThreshold = 3000     // 响应时间超过 3 秒认为慢
    this.errorThreshold = 3       // 连续 3 次错误触发降级
    this.recoveryThreshold = 5    // 连续 5 次成功触发恢复
  }

  /**
   * 获取上传槽位
   * @returns {Promise<number>} 槽位ID
   */
  async acquireSlot() {
    // 如果当前并发数已达上限，等待
    while (this.currentConcurrency >= this.maxConcurrency) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    const slotId = ++this.slotIdCounter
    this.activeSlots.set(slotId, {
      startTime: Date.now(),
      filePath: null
    })
    this.currentConcurrency++

    return slotId
  }

  /**
   * 释放上传槽位
   * @param {number} slotId 槽位ID
   * @param {boolean} success 是否成功
   * @param {number} responseTime 响应时间(ms)
   */
  releaseSlot(slotId, success, responseTime = 0) {
    if (!this.activeSlots.has(slotId)) return

    this.activeSlots.delete(slotId)
    this.currentConcurrency = Math.max(0, this.currentConcurrency - 1)

    // 记录响应时间
    if (responseTime > 0) {
      this.responseTimes.push(responseTime)
      if (this.responseTimes.length > this.responseTimeWindow) {
        this.responseTimes.shift()
      }
    }

    // 更新成功/失败计数
    if (success) {
      this.successCount++
      this.errorCount = 0  // 重置连续错误计数

      // 检查是否可以恢复并发数
      if (this.autoAdjustEnabled && this.successCount >= this.recoveryThreshold) {
        this.recoverConcurrency()
      }
    } else {
      this.errorCount++
      this.successCount = 0  // 重置连续成功计数

      // 检查是否需要降低并发数
      if (this.autoAdjustEnabled && this.errorCount >= this.errorThreshold) {
        this.reduceConcurrency()
      }
    }
  }

  /**
   * 设置最大并发数
   * @param {number} value
   */
  setMaxConcurrency(value) {
    this.maxConcurrency = Math.max(this.minConcurrency, Math.min(this.maxAllowedConcurrency, value))
  }

  /**
   * 启用/禁用自适应调整
   * @param {boolean} enabled
   */
  setAutoAdjust(enabled) {
    this.autoAdjustEnabled = enabled
  }

  /**
   * 根据网络状况自动调整并发数
   */
  adjustByNetworkCondition() {
    if (!this.autoAdjustEnabled) return

    const avgResponseTime = this.getAverageResponseTime()

    if (avgResponseTime > this.slowThreshold) {
      this.reduceConcurrency()
    } else if (avgResponseTime < this.slowThreshold / 2 && this.successCount >= this.recoveryThreshold) {
      this.recoverConcurrency()
    }
  }

  /**
   * 降低并发数
   */
  reduceConcurrency() {
    if (this.maxConcurrency > this.minConcurrency) {
      this.maxConcurrency--
      this.successCount = 0
      this.errorCount = 0
    }
  }

  /**
   * 恢复并发数
   */
  recoverConcurrency() {
    if (this.maxConcurrency < this.maxAllowedConcurrency) {
      this.maxConcurrency++
      this.successCount = 0
      this.errorCount = 0
    }
  }

  /**
   * 获取平均响应时间
   * @returns {number}
   */
  getAverageResponseTime() {
    if (this.responseTimes.length === 0) return 0
    const sum = this.responseTimes.reduce((a, b) => a + b, 0)
    return sum / this.responseTimes.length
  }

  /**
   * 获取当前状态
   * @returns {Object}
   */
  getStatus() {
    return {
      maxConcurrency: this.maxConcurrency,
      currentConcurrency: this.currentConcurrency,
      availableSlots: Math.max(0, this.maxConcurrency - this.currentConcurrency),
      avgResponseTime: this.getAverageResponseTime(),
      errorRate: this.getErrorRate(),
      autoAdjustEnabled: this.autoAdjustEnabled
    }
  }

  /**
   * 获取错误率
   * @returns {number}
   */
  getErrorRate() {
    const total = this.errorCount + this.successCount
    if (total === 0) return 0
    return this.errorCount / total
  }

  /**
   * 重置统计
   */
  reset() {
    this.responseTimes = []
    this.errorCount = 0
    this.successCount = 0
  }
}

module.exports = ConcurrencyController
