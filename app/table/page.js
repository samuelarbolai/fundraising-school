import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { getAdminContext } from '@/lib/admin/auth';
import { db } from '@/lib/db';
import { agentOutputs } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

const TARGET_AGENT = 'friendly-vc-analyst';

export default async function TablePage() {
  const context = await getAdminContext();
  if (context.error) {
    redirect('/admin');
  }

  const rows = await db
    .select()
    .from(agentOutputs)
    .where(eq(agentOutputs.agentSlug, TARGET_AGENT))
    .orderBy(desc(agentOutputs.createdAt))
    .limit(100);

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Friendly VC Analyst Table</h1>
          <p>Quick view of recent company screens and fit labels. Share via the admin console.</p>
        </div>
      </header>

      {rows.length === 0 ? (
        <section className="admin-section">
          <p>No analyst runs yet. Generate one from the admin console.</p>
        </section>
      ) : (
        <section className="admin-section">
          <table className="agent-output-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Fit</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                  <td>{row.fitLabel || '—'}</td>
                  <td>
                    <pre>{row.summary}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
