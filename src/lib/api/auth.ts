import type { ApiResult, AuthUser, StoredAuth } from '@/types/api'
import { apiRequest, authorizedRequest } from './client'

export interface Credentials {
  email: string
  password: string
}

// Lets the user tell devices apart if tokens are ever listed; one token per device name.
export const deviceName = (): string => `dlmnt-clipper/${import.meta.env.BROWSER}`

export const requestToken = ({ email, password }: Credentials): Promise<ApiResult<StoredAuth>> =>
  apiRequest<StoredAuth>('extension/token', {
    method: 'POST',
    body: { email, password, device_name: deviceName() },
  })

export const revokeToken = (): Promise<ApiResult<null>> =>
  authorizedRequest<null>('extension/token', { method: 'DELETE' })

export const fetchMe = (): Promise<ApiResult<AuthUser>> => authorizedRequest<AuthUser>('me')
