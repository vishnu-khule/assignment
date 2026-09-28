import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthUser } from "./clerk.guard";
import type { Request } from "express";

export const Auth = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<Request & { authUser: AuthUser }>();
    return req.authUser;
  },
);
