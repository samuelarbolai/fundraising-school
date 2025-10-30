export async function getAdminContext() {
  return {
    user: { id: 'local-admin' },
    email: 'admin@local',
    admin: { email: 'admin@local', role: 'admin' },
    isSuperAdmin: true,
  };
}
