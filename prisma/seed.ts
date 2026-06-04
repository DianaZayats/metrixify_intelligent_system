import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const demoTelegramId = BigInt(900000001);

  const existing = await prisma.telegramAccount.findUnique({
    where: { telegramUserId: demoTelegramId },
  });

  if (existing) {
    console.log('Seed data already exists, skipping.');
    return;
  }

  const user = await prisma.user.create({
    data: {
      timezone: 'UTC',
      telegramAccounts: {
        create: {
          telegramUserId: demoTelegramId,
          username: 'demo_user',
          firstName: 'Demo',
          languageCode: 'en',
        },
      },
    },
  });

  const entryDate = new Date();
  entryDate.setUTCHours(0, 0, 0, 0);

  const entry = await prisma.diaryEntry.create({
    data: {
      userId: user.id,
      sourceType: 'text',
      rawText: 'Woke up late today and did not feel great.',
      summaryText: 'Late wake-up with low wellbeing.',
      entryDate,
      processingStatus: 'completed',
      entrySources: {
        create: {
          userId: user.id,
          sourceType: 'text',
          idempotencyKey: `seed-entry-${user.id}`,
        },
      },
    },
  });

  const wellbeing = await prisma.metricDefinition.create({
    data: {
      userId: user.id,
      key: 'wellbeing',
      title: 'Wellbeing',
      description: 'Overall subjective wellbeing',
      valueType: 'ordinal',
      scaleMin: 1,
      scaleMax: 5,
      positiveDirection: 'higher_is_better',
      aliasesJson: ['mood', 'how I feel'],
      tagsJson: ['mood', 'mental-health'],
      createdFromEntryId: entry.id,
      confidence: 0.8,
    },
  });

  await prisma.metricObservation.create({
    data: {
      userId: user.id,
      entryId: entry.id,
      metricDefinitionId: wellbeing.id,
      observedAt: entryDate,
      valueNumber: 3,
      confidence: 0.78,
      evidenceText: 'did not feel great',
    },
  });

  await prisma.profileFact.create({
    data: {
      userId: user.id,
      key: 'typical_wake_preference',
      valueJson: { description: 'Often wakes after 9:00 on weekdays' },
      factType: 'routine',
      stability: 'evolving',
      confidence: 0.65,
      firstSeenEntryId: entry.id,
      lastSeenEntryId: entry.id,
      evidenceCount: 1,
      evidence: {
        create: {
          entryId: entry.id,
          evidenceText: 'Woke up late today',
        },
      },
    },
  });

  console.log(`Seeded demo user ${user.id} with sample entry and metrics.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
