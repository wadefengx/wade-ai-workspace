import { Test } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { PrismaService } from "./prisma/prisma.service";

describe("HealthController", () => {
  it("reports healthy when MongoDB responds", async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{
        provide: PrismaService,
        useValue: { $runCommandRaw: jest.fn().mockResolvedValue({ ok: 1 }) }
      }]
    }).compile();

    await expect(module.get(HealthController).getHealth()).resolves.toEqual({ status: "ok" });
  });
});
