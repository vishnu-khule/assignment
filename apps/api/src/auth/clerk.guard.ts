import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { clerkMiddleware, getAuth } from "@clerk/express";
import type { Request, Response } from "express";

export interface AuthUser {
  userId: string;
  orgId: string;
}

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private middleware = clerkMiddleware();

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.CLERK_AUTH_DISABLED === "true") {
      const req = context.switchToHttp().getRequest<Request>();
      (req as Request & { authUser: AuthUser }).authUser = {
        userId: "dev-user",
        orgId: "dev-org",
      };
      return true;
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    await new Promise<void>((resolve, reject) => {
      this.middleware(req, res, (err?: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const auth = getAuth(req);
    if (!auth?.userId) {
      throw new UnauthorizedException("Not authenticated");
    }

    const orgId =
      (auth.sessionClaims as { org_id?: string })?.org_id ?? "personal";

    (req as Request & { authUser: AuthUser }).authUser = {
      userId: auth.userId,
      orgId,
    };
    return true;
  }
}
