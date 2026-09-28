import { IsString, IsUUID, MinLength } from "class-validator";

export class PresignUploadDto {
  @IsUUID()
  session_id!: string;

  @IsString()
  @MinLength(1)
  filename!: string;

  @IsString()
  @MinLength(3)
  mime_type!: string;
}

export class CompleteUploadDto {
  @IsUUID()
  attachment_id!: string;
}
