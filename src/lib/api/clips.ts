import type { ApiResult } from '@/types/api'
import type { ExtractedPage } from '@/types/extracted-page'
import { authorizedRequest } from './client'

export type ClipPayload = ExtractedPage & { clippedAt: string }

export interface SavedClip {
  id: string
  createdAt: string
}

export const createClip = (payload: ClipPayload): Promise<ApiResult<SavedClip>> =>
  authorizedRequest<SavedClip>('clips', { method: 'POST', body: payload })
