import { eq } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { adminUsers } from '@/lib/db/schema';

const SUPER_ADMIN_EMAIL = 'samuel@arbolai.co';

export async function getAdminContext({ requireSuper = false } = {}) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    return { error: { status: 401, message: 'Unauthorized' } };
  }

  const email = (data.user.email || '').toLowerCase();
  if (!email) {
    return { error: { status: 403, message: 'Forbidden' } };
  }

  let rows = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);

  const isSuperAdmin = email === SUPER_ADMIN_EMAIL;

  if (!rows.length && isSuperAdmin) {
    const inserted = await db
      .insert(adminUsers)
      .values({
        email,
        role: 'superadmin',
        createdBy: data.user.id,
      })
      .onConflictDoUpdate({
        target: adminUsers.email,
        set: { role: 'superadmin' },
      })
      .returning();
    rows = inserted;
  }

  if (!rows.length) {
    return { error: { status: 403, message: 'Forbidden' } };
  }

  if (requireSuper && !isSuperAdmin) {
    return { error: { status: 403, message: 'Requires super admin' } };
  }

  return {
    user: data.user,
    email,
    admin: rows[0],
    isSuperAdmin,
  };
}
