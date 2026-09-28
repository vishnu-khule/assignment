import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import type { Request } from "express";
import { Auth } from "../auth/auth.decorator";
import type { AuthUser } from "../auth/clerk.guard";
import { ClerkAuthGuard } from "../auth/clerk.guard";
import { clientIpFromRequest } from "../http/client-ip";
import { ShareService } from "./share.service";
import { CreateShareDto, CustomerShareActionDto } from "./share.dto";

@Controller("share")
export class ShareController {
  constructor(private readonly share: ShareService) {}

  /** POST /share — contractor creates customer link */
  @Post()
  @UseGuards(ClerkAuthGuard)
  create(@Auth() user: AuthUser, @Body() dto: CreateShareDto) {
    return this.share.createLink(user.orgId, dto);
  }

  /** GET /share/s/:token — public read-only customer view */
  @Get("s/:token")
  getPublic(@Param("token") token: string) {
    return this.share.getByToken(token);
  }

  @Post("s/:token/approve")
  approve(
    @Param("token") token: string,
    @Body() dto: CustomerShareActionDto,
    @Req() req: Request,
  ) {
    return this.share.recordAction(
      token,
      "approve",
      dto,
      clientIpFromRequest(req),
    );
  }

  @Post("s/:token/request-changes")
  requestChanges(
    @Param("token") token: string,
    @Body() dto: CustomerShareActionDto,
    @Req() req: Request,
  ) {
    if (!dto.message?.trim()) {
      throw new BadRequestException("message is required");
    }
    return this.share.recordAction(
      token,
      "request_changes",
      dto,
      clientIpFromRequest(req),
    );
  }

  @Post("s/:token/sign")
  sign(
    @Param("token") token: string,
    @Body() dto: CustomerShareActionDto,
    @Req() req: Request,
  ) {
    return this.share.recordAction(
      token,
      "sign",
      dto,
      clientIpFromRequest(req),
    );
  }
}
