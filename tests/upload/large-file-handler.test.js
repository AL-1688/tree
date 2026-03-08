import { describe, it, expect, beforeEach } from 'vitest'
import LargeFileHandler from '../../electron/upload/large-file-handler'

describe('LargeFileHandler', () => {
  let handler

  beforeEach(() => {
    handler = new LargeFileHandler({ threshold: 50 * 1024 * 1024 })  // 50MB
  })

  describe('checkStrategy', () => {
    it('should return chunk for small files', () => {
      const result = handler.checkStrategy(10 * 1024 * 1024)  // 10MB

      expect(result.type).toBe('chunk')
      expect(result.fileSize).toBe(10 * 1024 * 1024)
    })

    it('should return lfs-recommended for large files', () => {
      const result = handler.checkStrategy(100 * 1024 * 1024)  // 100MB

      expect(result.type).toBe('lfs-recommended')
      expect(result.fileSize).toBe(100 * 1024 * 1024)
    })

    it('should return chunk for files at threshold', () => {
      const result = handler.checkStrategy(50 * 1024 * 1024)  // exactly 50MB

      expect(result.type).toBe('chunk')
    })

    it('should return lfs-recommended for files just over threshold', () => {
      const result = handler.checkStrategy(50 * 1024 * 1024 + 1)

      expect(result.type).toBe('lfs-recommended')
    })
  })

  describe('upload', () => {
    it('should throw error when chunkUploader not configured', async () => {
      const smallHandler = new LargeFileHandler()

      await expect(smallHandler.upload({ fileSize: 10 * 1024 * 1024 }))
        .rejects.toThrow('ChunkUploader not configured')
    })

    it('should return needConfirm for large files', async () => {
      const result = await handler.upload({ fileSize: 100 * 1024 * 1024 })

      expect(result.needConfirm).toBe(true)
      expect(result.type).toBe('lfs-recommended')
      expect(result.options).toBeDefined()
      expect(result.options.length).toBe(2)
    })

    it('should use chunk uploader for small files', async () => {
      const mockChunkUploader = {
        uploadLargeFile: vi.fn().mockResolvedValue({ success: true })
      }

      const handlerWithUploader = new LargeFileHandler({
        threshold: 50 * 1024 * 1024,
        chunkUploader: mockChunkUploader
      })

      const result = await handlerWithUploader.upload({
        fileSize: 10 * 1024 * 1024,
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'main',
        localPath: '/path/to/file.txt',
        targetPath: 'file.txt',
        message: 'Upload file'
      })

      expect(mockChunkUploader.uploadLargeFile).toHaveBeenCalled()
    })
  })

  describe('setThreshold', () => {
    it('should update threshold', () => {
      handler.setThreshold(100 * 1024 * 1024)  // 100MB

      expect(handler.getThreshold()).toBe(100 * 1024 * 1024)
    })
  })

  describe('getThreshold', () => {
    it('should return current threshold', () => {
      expect(handler.getThreshold()).toBe(50 * 1024 * 1024)
    })
  })

  describe('formatSize', () => {
    it('should format bytes correctly', () => {
      expect(LargeFileHandler.formatSize(0)).toBe('0 B')
      expect(LargeFileHandler.formatSize(500)).toBe('500 B')
    })

    it('should format kilobytes correctly', () => {
      expect(LargeFileHandler.formatSize(1024)).toBe('1 KB')
      expect(LargeFileHandler.formatSize(1536)).toBe('1.5 KB')
    })

    it('should format megabytes correctly', () => {
      expect(LargeFileHandler.formatSize(1024 * 1024)).toBe('1 MB')
      expect(LargeFileHandler.formatSize(50 * 1024 * 1024)).toBe('50 MB')
    })

    it('should format gigabytes correctly', () => {
      expect(LargeFileHandler.formatSize(1024 * 1024 * 1024)).toBe('1 GB')
    })
  })

  describe('checkFileList', () => {
    it('should return empty largeFiles when all files are small', () => {
      const files = [
        { path: 'file1.txt', size: 1024 },
        { path: 'file2.txt', size: 2048 }
      ]

      const result = handler.checkFileList(files)

      expect(result.hasLargeFiles).toBe(false)
      expect(result.largeFiles).toEqual([])
      expect(result.totalSize).toBe(3072)
    })

    it('should identify large files', () => {
      const files = [
        { path: 'small.txt', size: 1024 },
        { path: 'large.bin', size: 100 * 1024 * 1024 }  // 100MB
      ]

      const result = handler.checkFileList(files)

      expect(result.hasLargeFiles).toBe(true)
      expect(result.largeFiles.length).toBe(1)
      expect(result.largeFiles[0].path).toBe('large.bin')
      expect(result.largeFiles[0].formattedSize).toBe('100 MB')
    })

    it('should calculate total size correctly', () => {
      const files = [
        { path: 'file1.txt', size: 1024 },
        { path: 'file2.txt', size: 2048 },
        { path: 'file3.txt', size: 4096 }
      ]

      const result = handler.checkFileList(files)

      expect(result.totalSize).toBe(7168)
      expect(result.formattedTotalSize).toBe('7 KB')
    })

    it('should handle missing size', () => {
      const files = [
        { path: 'file1.txt', size: 1024 },
        { path: 'file2.txt' }  // no size
      ]

      const result = handler.checkFileList(files)

      expect(result.totalSize).toBe(1024)
    })
  })

  describe('generateRecommendation', () => {
    it('should return normal recommendation when no large files', () => {
      const checkResult = {
        hasLargeFiles: false,
        largeFiles: [],
        totalSize: 1024
      }

      const recommendation = handler.generateRecommendation(checkResult)

      expect(recommendation.type).toBe('normal')
      expect(recommendation.message).toBe('所有文件可以正常上传')
    })

    it('should return lfs-recommended when has large files', () => {
      const checkResult = {
        hasLargeFiles: true,
        largeFiles: [
          { path: 'large.bin', size: 100 * 1024 * 1024, formattedSize: '100 MB' }
        ],
        totalSize: 100 * 1024 * 1024
      }

      const recommendation = handler.generateRecommendation(checkResult)

      expect(recommendation.type).toBe('lfs-recommended')
      expect(recommendation.message).toContain('1 个大文件')
      expect(recommendation.suggestion).toBeDefined()
      expect(recommendation.learnMoreUrl).toBe('https://git-lfs.github.com/')
    })

    it('should list all large files in message', () => {
      const checkResult = {
        hasLargeFiles: true,
        largeFiles: [
          { path: 'large1.bin', size: 60 * 1024 * 1024, formattedSize: '60 MB' },
          { path: 'large2.bin', size: 80 * 1024 * 1024, formattedSize: '80 MB' }
        ],
        totalSize: 140 * 1024 * 1024
      }

      const recommendation = handler.generateRecommendation(checkResult)

      expect(recommendation.message).toContain('large1.bin')
      expect(recommendation.message).toContain('large2.bin')
    })
  })
})
