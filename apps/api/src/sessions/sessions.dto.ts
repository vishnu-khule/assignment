import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateSessionDto {
  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  customer_name?: string;
}

export class PostMessageDto {
  @IsString()
  @MinLength(1)
  content!: string;
}
