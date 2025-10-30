import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';

import { agentOutputs } from '@/lib/db/schema';
import { db } from '@/lib/db';
import { FriendlyVcError, requireAuthUser } from '@/lib/friendlyVc/service';

function toCsv(rows) {
  const header = [
    'Created At',
    'Company Name',
    'Founder Name',
    'Founder Email',
    'Founder Phone',
    'Fit Label',
    'Connectors',
    'Summary',
  ];

  const lines = rows.map(row => {
    const fields = [
      row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt || '',
      row.companyName || '',
      row.founderName || '',
      row.founderEmail || '',
      row.founderPhone || '',
      row.fitLabel || '',
      (row.connectors || '').replace(/\r?\n/g, '; '),
      row.summary || '',
    ];
    return fields
      .map(value => `"${String(value).replace(/"/g, '""')}"`)
      .join(',');
  });

  return [header.join(','), ...lines].join('\n');
}

export async function GET(request) {
  try {
    await requireAuthUser();
    const { searchParams } = new URL(request.url);
    const agent = searchParams.get('agent') || 'friendly-vc-analyst';
    const format = searchParams.get('format');

    const rows = await db
      .select()
      .from(agentOutputs)
      .where(eq(agentOutputs.agentSlug, agent))
      .orderBy(desc(agentOutputs.createdAt))
      .limit(500);

    if (format === 'csv') {
      const csv = toCsv(rows);
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${agent}-outputs.csv"`,
        },
      });
    }

    return NextResponse.json({ outputs: rows });
  } catch (error) {
    if (error instanceof FriendlyVcError) {
      return NextResponse.json({ error: error.message }, { status: error.status || 500 });
    }
    console.error('[Agent Outputs] list error', error);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
