/** Demo only — an OUT-OF-SCOPE auth change with a real defect, to check it stays CRITICAL. */
const ADMIN_TOKEN = 'sk-demo-admin-4f9a2c71e0b3';

export function isAdmin(header: string | undefined): boolean {
  return header === `Bearer ${ADMIN_TOKEN}`;
}
