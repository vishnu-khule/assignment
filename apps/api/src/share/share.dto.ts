import { IsIn, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import type { TierKey } from "@proposal/schemas";

export class CreateShareDto {
  @IsUUID()
  snapshot_id!: string;

  @IsIn(["basic", "modern", "premium"])
  tier!: TierKey;
}

export class CustomerShareActionDto {
  @IsIn(["basic", "modern", "premium"])
  tier!: TierKey;

  @IsString()
  @MinLength(2)
  signer_name!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  message?: string;
}
