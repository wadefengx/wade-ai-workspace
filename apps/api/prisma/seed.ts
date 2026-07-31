import { PrismaClient, UserRole, WorkspaceRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function backfillAgentTypes() {
  await prisma.$runCommandRaw({
    update: "Agent",
    updates: [{
      q: {
        type: {
          $exists: false
        },
        providerConfigRef: null
      },
      u: {
        $set: {
          type: "OLLAMA"
        }
      },
      multi: true
    }, {
      q: {
        type: {
          $exists: false
        }
      },
      u: {
        $set: {
          type: "OPENAI_COMPATIBLE"
        }
      },
      multi: true
    }]
  });
}

async function backfillWorkspaceIcons() {
  await prisma.$runCommandRaw({
    update: "Workspace",
    updates: [{
      q: {
        icon: {
          $exists: false
        }
      },
      u: {
        $set: {
          icon: "TeamOutlined"
        }
      },
      multi: true
    }, {
      q: {
        icon: null
      },
      u: {
        $set: {
          icon: "TeamOutlined"
        }
      },
      multi: true
    }]
  });
}

async function main() {
  await backfillAgentTypes();
  await backfillWorkspaceIcons();
  const adminPasswordHash = await hash("admin", 10);
  await prisma.user.upsert({
    where: { email: "admin@wade.local" },
    update: {
      name: "admin",
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN
    },
    create: {
      email: "admin@wade.local",
      name: "admin",
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN
    }
  });

  const email = "demo@wade.local";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Demo User", passwordHash: "seed-not-for-login" }
  });

  const existing = await prisma.workspace.findFirst({ where: { name: "Demo Workspace" } });
  if (existing) return;

  await prisma.workspace.create({
    data: {
      name: "Demo Workspace",
      icon: "TeamOutlined",
      createdById: user.id,
      members: { create: { userId: user.id, role: WorkspaceRole.OWNER } },
      channels: { create: { name: "general" } }
    }
  });
}

main().finally(() => prisma.$disconnect());
