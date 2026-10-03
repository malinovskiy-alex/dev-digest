/** Demo only — an OUT-OF-SCOPE admin change with a real defect, to check it stays CRITICAL. */
export async function searchOrders(db: { query: (sql: string) => Promise<unknown[]> }, customer: string) {
  return db.query(`SELECT * FROM orders WHERE customer_name = '${customer}' ORDER BY created_at DESC`);
}
