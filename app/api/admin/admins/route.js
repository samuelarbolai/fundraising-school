import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { adminUsers } from '@/lib/db/schema';
import { getAdminContext } from '@/lib/admin/auth';

export async function GET() {
  const context = await getAdminContext();
  if (context.error) {
    return NextResponse.json({ error: context.error.message }, { status: context.error.status });
  }

  const admins = await db
    .select()
    .from(adminUsers)
    .orderBy(desc(adminUsers.createdAt));

  return NextResponse.json({ admins, isSuperAdmin: context.isSuperAdmin });
}

export async function POST(request) {
  const context = await getAdminContext({ requireSuper: true });
  if (context.error) {
    return NextResponse.json({ error: context.error.message }, { status: context.error.status });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const email = (payload?.email || '').trim().toLowerCase();

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
  }

  const existing = await db
    .select({ email: adminUsers.email })
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);

  if (existing.length) {
    return NextResponse.json({ error: 'That admin already exists.' }, { status: 409 });
  }

  const [row] = await db
    .insert(adminUsers)
    .values({
      email,
      role: payload?.role || 'admin',
      createdBy: context.user.id,
    })
    .returning();

  return NextResponse.json({ admin: row }, { status: 201 });
}
