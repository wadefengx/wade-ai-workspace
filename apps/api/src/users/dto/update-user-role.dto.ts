import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { UserRole } from "@prisma/client";

export class UpdateUserRoleDto {
  @ApiProperty({
    description: "Updated global role",
    example: UserRole.ADMIN,
    required: true,
    enum: UserRole
  })
  @IsEnum(UserRole, { message: "role must be USER or ADMIN" })
  role!: UserRole;
}
