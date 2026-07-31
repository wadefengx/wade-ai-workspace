import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";

@Module({
  imports: [JwtModule.register({
    secret: process.env.JWT_SECRET ?? "development-only-change-me",
    signOptions: {
      algorithm: "HS256",
      expiresIn: "15m"
    }
  })],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule]
})
export class AuthModule {}
