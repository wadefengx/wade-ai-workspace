import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { WorkspaceRole } from "@prisma/client";

export class UpdateMemberRoleDto {
  @ApiProperty({
    description: "Updated workspace role",
    example: WorkspaceRole.ADMIN,
    required: true,
    enum: WorkspaceRole
  })
  @IsEnum(WorkspaceRole, { message: "role must be MEMBER or ADMIN" })
  role!: WorkspaceRole;
}
