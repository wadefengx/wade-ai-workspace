import { UnauthorizedException, createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthenticatedUser } from "../types/authenticated-user";

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();

  if (!request.user) {
    throw new UnauthorizedException("未登录或登录已过期");
  }

  return request.user;
});
