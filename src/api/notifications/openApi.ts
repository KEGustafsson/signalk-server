import { OpenApiDescription } from '../swagger'
import notificationsApiDoc from './openApi.json'

export const notificationsApiRecord = {
  name: 'notifications',
  path: '/signalk/v2/api/notifications',
  apiDoc: notificationsApiDoc as unknown as OpenApiDescription
}
