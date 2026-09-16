import { createParamDecorator, UnauthorizedException } from '@nestjs/common';
import { API_USER } from './auth.types';
export const CurrentUser = createParamDecorator((_data, context) => {
    const request = context.switchToHttp().getRequest();
    if (!request[API_USER])
        throw new UnauthorizedException('Authentication required');
    return request[API_USER];
});
