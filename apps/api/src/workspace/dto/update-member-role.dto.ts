import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { WorkspaceRole } from "@prisma/client";

export class UpdateMemberRoleDto {
  @ApiProperty({
    description: "更新后的工作区角色",
    example: WorkspaceRole.ADMIN,
    required: true,
    enum: WorkspaceRole
  })
  @IsEnum(WorkspaceRole, { message: "角色只能是 MEMBER 或 ADMIN" })
  role!: WorkspaceRole;
}
