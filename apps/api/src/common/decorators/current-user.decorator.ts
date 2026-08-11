import { UnauthorizedException, createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthenticatedUser } from "../types/authenticated-user";

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();

  if (!request.user) {
    throw new UnauthorizedException("Not signed in or session has expired");
  }

  return request.user;
});
