/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

/**
 * Idempotent development seed: an admin user with a workspace and a sample
 * board. Safe to run repeatedly. Do NOT run against production.
 */
async function main(): Promise<void> {
  const email = 'admin@ai-board.local';
  const password = 'changeme-admin-12345';

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: 'Admin', passwordHash },
  });

  let workspace = await prisma.workspace.findFirst({
    where: { ownerId: user.id, deletedAt: null },
  });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: 'Demo Workspace',
        slug: 'demo-workspace',
        ownerId: user.id,
        members: { create: { userId: user.id, role: 'OWNER' } },
      },
    });
  }

  const existingBoard = await prisma.board.findFirst({
    where: { workspaceId: workspace.id, title: 'Welcome Board' },
  });
  if (!existingBoard) {
    await prisma.board.create({
      data: {
        workspaceId: workspace.id,
        title: 'Welcome Board',
        description: 'Your first AI-Board canvas.',
        createdById: user.id,
        members: { create: { userId: user.id, role: 'EDITOR' } },
      },
    });
  }

  console.log('Seed complete.');
  console.log(`  Login: ${email} / ${password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
