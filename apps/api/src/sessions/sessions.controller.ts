import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { Auth } from "../auth/auth.decorator";
import type { AuthUser } from "../auth/clerk.guard";
import { ClerkAuthGuard } from "../auth/clerk.guard";
import { SessionsService } from "./sessions.service";
import { CreateSessionDto, PostMessageDto } from "./sessions.dto";

@Controller("sessions")
@UseGuards(ClerkAuthGuard)
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  /** POST /sessions — create proposal session */
  @Post()
  create(@Auth() user: AuthUser, @Body() dto: CreateSessionDto) {
    return this.sessions.create(user.orgId, dto);
  }

  @Get()
  list(@Auth() user: AuthUser) {
    return this.sessions.list(user.orgId);
  }

  @Get(":id")
  get(@Auth() user: AuthUser, @Param("id") id: string) {
    return this.sessions.get(user.orgId, id);
  }

  @Get(":id/extractions")
  extractions(@Auth() user: AuthUser, @Param("id") id: string) {
    return this.sessions.listExtractions(user.orgId, id);
  }

  @Get(":id/attachments")
  attachments(@Auth() user: AuthUser, @Param("id") id: string) {
    return this.sessions.listAttachments(user.orgId, id);
  }

  @Get(":id/agent-runs")
  agentRuns(@Auth() user: AuthUser, @Param("id") id: string) {
    return this.sessions.listAgentRuns(user.orgId, id);
  }

  /** POST /sessions/:id/messages — chat + clarification */
  @Post(":id/messages")
  postMessage(
    @Auth() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: PostMessageDto,
  ) {
    return this.sessions.postMessage(user.orgId, id, dto);
  }

  /** SSE: agent steps, tool events, streamed assistant tokens, then `done` payload. */
  @Post(":id/messages/stream")
  postMessageStream(
    @Auth() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: PostMessageDto,
    @Res() res: Response,
  ) {
    return this.sessions.postMessageStream(user.orgId, id, dto, res);
  }
}
