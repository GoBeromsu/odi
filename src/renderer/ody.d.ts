import type { OdyApi } from '../shared/api.ts'

declare global {
  interface Window {
    ody: OdyApi
  }
}
