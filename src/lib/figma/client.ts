import type { FigmaFileResponse, FigmaImagesResponse } from './types'

const BASE = `${import.meta.env.BASE_URL}api/figma`

export class FigmaApiError extends Error {
  status: number
  body: string

  constructor(status: number, body: string) {
    super(`Figma API ${status}: ${body.slice(0, 200)}`)
    this.status = status
    this.body = body
  }
}

async function figmaFetch(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      'X-Figma-Token': token,
    },
  })
  return res
}

export async function getFile(
  fileKey: string,
  token: string,
  depth = 4,
): Promise<FigmaFileResponse> {
  const path = `/v1/files/${encodeURIComponent(fileKey)}?depth=${depth}`
  const res = await figmaFetch(path, token)
  const text = await res.text()
  if (!res.ok) throw new FigmaApiError(res.status, text)
  return JSON.parse(text) as FigmaFileResponse
}

export async function getImages(
  fileKey: string,
  nodeIds: string[],
  token: string,
  format: 'png' | 'jpg' = 'png',
  scale = 2,
): Promise<FigmaImagesResponse> {
  if (nodeIds.length === 0) {
    return { err: null, images: {} }
  }
  const params = new URLSearchParams()
  params.set('ids', nodeIds.join(','))
  params.set('format', format)
  params.set('scale', String(scale))
  const path = `/v1/images/${encodeURIComponent(fileKey)}?${params.toString()}`
  const res = await figmaFetch(path, token)
  const text = await res.text()
  if (!res.ok) throw new FigmaApiError(res.status, text)
  return JSON.parse(text) as FigmaImagesResponse
}
