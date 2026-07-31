import { Test } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { OllamaService } from "./ollama.service";
import { PrismaService } from "./prisma/prisma.service";

describe("HealthController", () => {
  it("reports healthy when MongoDB responds", async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{
        provide: PrismaService,
        useValue: { $runCommandRaw: jest.fn().mockResolvedValue({ ok: 1 }) }
      }, {
        provide: OllamaService,
        useValue: { assertAvailable: jest.fn().mockResolvedValue(undefined) }
      }]
    }).compile();

    await expect(module.get(HealthController).getHealth()).resolves.toEqual({ status: "ok" });
  });
});
