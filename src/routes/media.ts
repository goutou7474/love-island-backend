import { randomBytes, randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuthenticatedUser } from '../auth/context.js'
import type { IslandStore, MediaAssetRecord } from '../domain/store.js'
import { apiError } from '../http/errors.js'
import type { MediaStorage } from '../media/storage.js'

export interface MediaRouteOptions {
  jwtSecret: string
  maxBytes: number
  mediaStorage: MediaStorage
  store: IslandStore
}

const allowedContentTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const mediaUploadBodySchema = z.object({
  filename: z.string().min(1).max(160),
  contentType: z.string().min(1).max(80),
  dataBase64: z.string().min(1),
})

export async function registerMediaRoutes(app: FastifyInstance, options: MediaRouteOptions) {
  app.post('/media', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, options)
    const couple = await options.store.getCoupleForUser(user.id)

    if (!couple) {
      throw apiError(404, 'couple_not_found', '还没有可以保存照片的小岛')
    }

    const body = mediaUploadBodySchema.parse(request.body)
    if (!allowedContentTypes.has(body.contentType)) {
      throw apiError(400, 'validation_error', '只支持上传 jpg、png、webp 或 gif 图片')
    }

    const bytes = decodeBase64Image(body.dataBase64)
    if (bytes.length === 0 || bytes.length > options.maxBytes) {
      throw apiError(400, 'validation_error', `图片大小需要在 1 字节到 ${options.maxBytes} 字节之间`)
    }

    const storageKey = `${couple.id}/${randomUUID()}${extensionForContentType(body.contentType)}`
    const readToken = randomBytes(24).toString('base64url')

    await options.mediaStorage.write({
      storageKey,
      contentType: body.contentType,
      bytes,
    })

    const asset = await options.store.createMediaAsset({
      coupleId: couple.id,
      ownerUserId: user.id,
      filename: body.filename,
      contentType: body.contentType,
      byteSize: bytes.length,
      storageKey,
      readToken,
    })

    return reply.status(201).send({
      asset: toMediaAssetView(asset),
    })
  })

  app.get('/media/:assetId/file', async (request, reply) => {
    const params = z.object({ assetId: z.string().uuid() }).parse(request.params)
    const query = z.object({ token: z.string().min(1) }).parse(request.query)
    const asset = await options.store.findMediaAssetById(params.assetId)

    if (!asset) {
      throw apiError(404, 'media_not_found', '这张照片已经不在小岛上了')
    }

    if (asset.readToken !== query.token) {
      throw apiError(403, 'media_forbidden', '这张照片暂时不能打开')
    }

    const bytes = await options.mediaStorage.read(asset.storageKey)
    if (!bytes) {
      throw apiError(404, 'media_not_found', '这张照片已经不在小岛上了')
    }

    return reply
      .header('cache-control', 'private, max-age=31536000')
      .header('content-type', asset.contentType)
      .send(bytes)
  })
}

function toMediaAssetView(asset: MediaAssetRecord) {
  return {
    id: asset.id,
    coupleId: asset.coupleId,
    ownerUserId: asset.ownerUserId,
    filename: asset.filename,
    contentType: asset.contentType,
    byteSize: asset.byteSize,
    url: `/media/${asset.id}/file?token=${encodeURIComponent(asset.readToken)}`,
    createdAt: asset.createdAt,
  }
}

function decodeBase64Image(value: string) {
  const normalized = value.replace(/\s/g, '')

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 === 1) {
    throw apiError(400, 'validation_error', '图片内容不是有效的 base64')
  }

  return Buffer.from(normalized, 'base64')
}

function extensionForContentType(contentType: string) {
  if (contentType === 'image/jpeg') return '.jpg'
  if (contentType === 'image/png') return '.png'
  if (contentType === 'image/webp') return '.webp'
  if (contentType === 'image/gif') return '.gif'
  return ''
}
