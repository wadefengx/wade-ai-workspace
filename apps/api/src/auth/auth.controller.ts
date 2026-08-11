import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/types/authenticated-user";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Register a new user" })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "User login" })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh authentication token" })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "User logout" })
  @ApiBearerAuth()
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user.id);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get current authenticated user" })
  @ApiBearerAuth()
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getCurrentUser(user);
  }

  @Patch("password")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Change current user password" })
  @ApiBearerAuth()
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }
}
