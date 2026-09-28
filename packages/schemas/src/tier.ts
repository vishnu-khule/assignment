import { z } from "zod";

export const TierKeySchema = z.enum(["basic", "modern", "premium"]);
export type TierKey = z.infer<typeof TierKeySchema>;
