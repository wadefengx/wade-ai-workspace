import "dotenv/config";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];
const JWT_SECRET_PLACEHOLDERS = new Set([
  "development-only-change-me",
  "replace-with-a-long-random-secret"
]);

export function resolveCorsOrigins() {
  const configuredOrigins = process.env.CORS_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configuredOrigins?.length ? configuredOrigins : DEFAULT_CORS_ORIGINS;
}

export function validateRuntimeConfiguration() {
  // ponytail: an unset NODE_ENV is the existing local host-development contract.
  if (process.env.NODE_ENV === undefined || process.env.NODE_ENV === "development") {
    return;
  }

  const jwtSecret = process.env.JWT_SECRET?.trim();

  if (!jwtSecret || JWT_SECRET_PLACEHOLDERS.has(jwtSecret)) {
    throw new Error("JWT_SECRET must be set to a non-placeholder value outside development");
  }
}

async function bootstrap() {
  validateRuntimeConfiguration();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.enableCors({ origin: resolveCorsOrigins(), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Wade AI Workspace API")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("swagger", app, swaggerDocument, {
    useGlobalPrefix: true
  });
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3001, "0.0.0.0");
}

if (require.main === module) {
  void bootstrap();
}
