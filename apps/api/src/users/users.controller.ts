import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthenticatedUser } from "../common/types/authenticated-user";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: "Get users" })
  @ApiBearerAuth()
  listUsers(@CurrentUser() user: AuthenticatedUser, @Query("q") query?: string) {
    return this.usersService.listUsers(user.id, query);
  }

  @Get("search")
  @ApiOperation({ summary: "Search users" })
  @ApiBearerAuth()
  searchUsers(@CurrentUser() user: AuthenticatedUser, @Query("q") query?: string) {
    return this.usersService.listUsers(user.id, query);
  }

  @Patch(":userId")
  @ApiOperation({ summary: "Update user global role" })
  @ApiBearerAuth()
  updateUserRole(
    @Param("userId") userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserRoleDto
  ) {
    return this.usersService.updateUserRole(user.id, userId, dto);
  }

  @Delete(":userId")
  @ApiOperation({ summary: "Delete a user" })
  @ApiBearerAuth()
  removeUser(@Param("userId") userId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.removeUser(user.id, userId);
  }
}
