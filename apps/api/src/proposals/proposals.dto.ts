import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import type { TierKey } from "@proposal/schemas";

class PricedLineItemDto {
  @IsString()
  description!: string;

  @IsNumber()
  @Min(0)
  qty!: number;

  @IsString()
  unit!: string;

  @IsNumber()
  @Min(0)
  unit_price!: number;

  @IsNumber()
  @Min(0)
  extended!: number;
}

export class PatchTierLineItemsDto {
  @IsIn(["basic", "modern", "premium"])
  tier!: TierKey;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricedLineItemDto)
  line_items!: PricedLineItemDto[];
}
