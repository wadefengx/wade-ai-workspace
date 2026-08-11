import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsOptional } from "class-validator";
import { WorkspaceRole } from "@prisma/client";

export class CreateMemberDto {
  @ApiProperty({ description: "Email address of the member to add", example: "bob@wade.local", required: true })
  @IsEmail({}, { message: "Invalid email address format" })
  email!: string;

  @ApiProperty({
    description: "Workspace role for the new member",
    example: WorkspaceRole.MEMBER,
    required: false,
    enum: WorkspaceRole
  })
  @IsOptional()
  @IsEnum(WorkspaceRole, { message: "role must be MEMBER or ADMIN" })
  role?: WorkspaceRole;
}
