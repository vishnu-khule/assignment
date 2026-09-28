import { z } from "zod";
import { TierKeySchema } from "./tier.js";

export const CustomerActionTypeSchema = z.enum([
  "approve",
  "request_changes",
  "sign",
]);

export const CustomerActionPayloadSchema = z.object({
  action: CustomerActionTypeSchema,
  tier: TierKeySchema,
  signer_name: z.string().min(1),
  message: z.string().optional(),
  client_ip: z.string(),
  at: z.string(),
});

export type CustomerActionType = z.infer<typeof CustomerActionTypeSchema>;
export type CustomerActionPayload = z.infer<typeof CustomerActionPayloadSchema>;
