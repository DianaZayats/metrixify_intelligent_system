/**
 * Audit syndrome-track diary entries: compare raw text vs stored metrics.
 * Usage: npx tsx scripts/qa/audit-syndrome-track.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const entries = await prisma.diaryEntry.findMany({
    where: { rawText: { contains: 'День' } },
    orderBy: { entryDate: 'asc' },
    select: {
      id: true,
      entryDate: true,
      rawText: true,
      processingStatus: true,
      metricObservations: {
        select: {
          valueNumber: true,
          valueBoolean: true,
          evidenceText: true,
          metricDefinition: {
            select: {
              key: true,
              title: true,
              scaleMin: true,
              scaleMax: true,
              valueType: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  const report = entries.map((entry) => {
    const dayMatch = entry.rawText?.match(/День\s+(\d+)/i);
    return {
      day: dayMatch ? Number(dayMatch[1]) : null,
      entryDate: entry.entryDate.toISOString().slice(0, 10),
      status: entry.processingStatus,
      textPreview: entry.rawText?.replace(/\s+/g, ' ').slice(0, 100) ?? '',
      metricCount: entry.metricObservations.length,
      metrics: entry.metricObservations.map((m) => ({
        key: m.metricDefinition.key,
        title: m.metricDefinition.title,
        value: m.valueNumber ?? m.valueBoolean,
        scale:
          m.metricDefinition.scaleMin != null && m.metricDefinition.scaleMax != null
            ? `${m.metricDefinition.scaleMin}-${m.metricDefinition.scaleMax}`
            : null,
        evidence: m.evidenceText?.slice(0, 80) ?? '',
      })),
    };
  });

  console.log(JSON.stringify(report, null, 2));
  console.error(`\nTotal entries: ${report.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
