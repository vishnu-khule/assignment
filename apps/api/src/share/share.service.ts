import {
  Injectable,
  NotFoundException,
  GoneException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import {
  createShareLink,
  getCustomerActionsByToken,
  getShareLink,
  getSnapshotById,
  isDbConfigured,
  recordCustomerAction,
} from "@proposal/db";
import {
  CustomerActionPayloadSchema,
  type CustomerActionType,
  type TierKey,
} from "@proposal/schemas";
import { DataAccessService } from "../data/data-access.service";
import type { CreateShareDto, CustomerShareActionDto } from "./share.dto";
import { InMemoryStore } from "../store/in-memory.store";

@Injectable()
export class ShareService {
  constructor(
    private readonly data: DataAccessService,
    private readonly memory: InMemoryStore,
  ) {}

  async createLink(orgId: string, dto: CreateShareDto) {
    const snapshot = await this.data.getSnapshotById(dto.snapshot_id);
    if (!snapshot || snapshot.org_id !== orgId) {
      throw new NotFoundException("Snapshot not found");
    }

    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    if (isDbConfigured()) {
      await createShareLink({
        token,
        snapshotId: dto.snapshot_id,
        orgId,
        tier: dto.tier,
        expiresAt,
      });
    } else {
      this.memory.shareLinks.set(token, {
        token,
        snapshot_id: dto.snapshot_id,
        org_id: orgId,
        tier: dto.tier,
        expires_at: expiresAt.toISOString(),
      });
    }

    const base = process.env.WEB_ORIGIN ?? "http://localhost:5173";
    return {
      url: `${base}/s/${token}`,
      token,
      expires_at: expiresAt.toISOString(),
      tier: dto.tier,
    };
  }

  private async resolveLink(token: string) {
    if (isDbConfigured()) {
      const link = await getShareLink(token);
      if (!link) return null;
      return {
        snapshot_id: link.snapshotId,
        expires_at: link.expiresAt,
        tier: (link.tier as TierKey) ?? "modern",
      };
    }
    const link = this.memory.shareLinks.get(token);
    if (!link) return null;
    return {
      snapshot_id: link.snapshot_id,
      expires_at: new Date(link.expires_at),
      tier: link.tier ?? "modern",
    };
  }

  private async latestStatus(token: string) {
    if (isDbConfigured()) {
      const rows = await getCustomerActionsByToken(token);
      const latest = rows[0];
      if (!latest) return null;
      const payload = CustomerActionPayloadSchema.safeParse(latest.payload);
      return {
        action: latest.action as CustomerActionType,
        at: payload.success ? payload.data.at : latest.createdAt.toISOString(),
        signer_name: payload.success ? payload.data.signer_name : undefined,
        client_ip: payload.success ? payload.data.client_ip : undefined,
      };
    }
    const rows = this.memory.customerActions.get(token) ?? [];
    const latest = rows[rows.length - 1];
    if (!latest) return null;
    const payload = CustomerActionPayloadSchema.safeParse(latest.payload);
    return {
      action: latest.action as CustomerActionType,
      at: payload.success ? payload.data.at : latest.created_at,
      signer_name: payload.success ? payload.data.signer_name : undefined,
      client_ip: payload.success ? payload.data.client_ip : undefined,
    };
  }

  async getByToken(token: string) {
    const link = await this.resolveLink(token);
    if (!link) throw new NotFoundException("Invalid link");
    if (link.expires_at < new Date()) {
      throw new GoneException("Link expired");
    }

    const snapshot =
      (await this.data.getSnapshotById(link.snapshot_id)) ??
      (isDbConfigured() ? await getSnapshotById(link.snapshot_id) : null);
    if (!snapshot) throw new NotFoundException("Proposal not found");

    const tier = link.tier;
    const bundle = snapshot.tiers[tier];

    return {
      snapshot_id: snapshot.snapshot_id,
      tier,
      customer: snapshot.customer,
      branding: snapshot.branding,
      documented_assumptions: snapshot.documented_assumptions ?? null,
      assumptions: snapshot.assumptions,
      currency: snapshot.currency,
      pricing: {
        total: bundle.pricing.total,
        subtotal: bundle.pricing.subtotal,
        tax: bundle.pricing.tax,
        valid_until: bundle.pricing.valid_until,
      },
      document_sections: bundle.document_sections ?? null,
      narrative: bundle.narrative,
      customer_status: await this.latestStatus(token),
      read_only: true,
    };
  }

  async recordAction(
    token: string,
    action: CustomerActionType,
    dto: CustomerShareActionDto,
    clientIp: string,
  ) {
    await this.getByToken(token);

    const at = new Date().toISOString();
    const payload = CustomerActionPayloadSchema.parse({
      action,
      tier: dto.tier,
      signer_name: dto.signer_name,
      message: dto.message?.trim() || undefined,
      client_ip: clientIp,
      at,
    });

    if (isDbConfigured()) {
      await recordCustomerAction(token, action, payload);
    } else {
      const list = this.memory.customerActions.get(token) ?? [];
      list.push({
        action,
        payload,
        created_at: at,
      });
      this.memory.customerActions.set(token, list);
    }

    return {
      ok: true,
      action,
      recorded_at: at,
      client_ip: clientIp,
    };
  }
}
