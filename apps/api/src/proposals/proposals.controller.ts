import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { Auth } from "../auth/auth.decorator";
import type { AuthUser } from "../auth/clerk.guard";
import { ClerkAuthGuard } from "../auth/clerk.guard";
import { ProposalsService } from "./proposals.service";
import { PatchTierLineItemsDto } from "./proposals.dto";

@Controller("proposals")
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  /** POST /proposals/:sessionId/generate */
  @Post(":sessionId/generate")
  @UseGuards(ClerkAuthGuard)
  generate(@Auth() user: AuthUser, @Param("sessionId") sessionId: string) {
    return this.proposals.enqueueGenerate(user.orgId, sessionId);
  }

  /** GET /proposals/:sessionId/options */
  @Get(":sessionId/options")
  @UseGuards(ClerkAuthGuard)
  async options(@Auth() user: AuthUser, @Param("sessionId") sessionId: string) {
    return this.proposals.getOptions(user.orgId, sessionId);
  }

  /** PATCH /proposals/:sessionId/line-items — edit priced lines before export */
  @Patch(":sessionId/line-items")
  @UseGuards(ClerkAuthGuard)
  patchLineItems(
    @Auth() user: AuthUser,
    @Param("sessionId") sessionId: string,
    @Body() dto: PatchTierLineItemsDto,
  ) {
    return this.proposals.patchTierLineItems(user.orgId, sessionId, dto);
  }

  /** GET /proposals/:sessionId/options/:tier/exports/:format */
  @Get(":sessionId/options/:tier/exports/:format")
  @UseGuards(ClerkAuthGuard)
  async exportUrl(
    @Auth() user: AuthUser,
    @Param("sessionId") sessionId: string,
    @Param("tier") tier: string,
    @Param("format") format: string,
  ) {
    return this.proposals.getExportUrl(user.orgId, sessionId, tier, format);
  }
}
