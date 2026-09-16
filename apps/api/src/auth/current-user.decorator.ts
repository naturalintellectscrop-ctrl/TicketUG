import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { ApiUser, API_USER } from './auth.types'

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): ApiUser => {
  const request = context.switchToHttp().getRequest<{ [API_USER]?: ApiUser }>()
  if (!request[API_USER]) throw new UnauthorizedException('Authentication required')
  return request[API_USER]
})
