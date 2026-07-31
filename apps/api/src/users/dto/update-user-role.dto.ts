import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { UserRole } from "@prisma/client";

export class UpdateUserRoleDto {
  @ApiProperty({
    description: "更新后的全局角色",
    example: UserRole.ADMIN,
    required: true,
    enum: UserRole
  })
  @IsEnum(UserRole, { message: "角色只能是 USER 或 ADMIN" })
  role!: UserRole;
}
