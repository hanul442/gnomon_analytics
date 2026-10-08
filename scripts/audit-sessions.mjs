// Throwaway audit accounts for the live audit (one per plan) and a session for each that ends with the run.
// stdout: SQL for D1. stderr: {plan: token} JSON for the audit script. Tokens are random per run.
import { randomBytes, createHash } from 'node:crypto';
const now = new Date(), iso = (d) => d.toISOString(), end = new Date(now.getTime() + 2 * 3600e3);
const sql = [], tokens = {};
for (const plan of ['free', 'plus', 'alpha', 'pro']) {
  const id = `audit-${plan}`, email = `audit-${plan}@gnomon.invalid`, token = randomBytes(32).toString('hex');
  tokens[plan] = token;
  sql.push(`INSERT OR IGNORE INTO users (id, email, plan, role, created_at, terms_at) VALUES ('${id}', '${email}', '${plan}', 'user', '${iso(now)}', '${iso(now)}');`);
  sql.push(`UPDATE users SET plan = '${plan}', role = 'user', disabled = 0 WHERE id = '${id}';`);
  sql.push(`DELETE FROM sessions WHERE user_id = '${id}';`);
  sql.push(`INSERT INTO sessions (hash, user_id, created_at, expires_at) VALUES ('${createHash('sha256').update(token).digest('hex')}', '${id}', '${iso(now)}', '${iso(end)}');`);
}
process.stdout.write(sql.join('\n') + '\n');
process.stderr.write(JSON.stringify(tokens));
