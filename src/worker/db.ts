// The slice of Cloudflare D1 the API uses. Kept as our own interface so the API compiles
// and is tested under Node (src/worker/testDb.ts) without the Workers runtime.

export interface D1Result<T> { results: T[]; meta?: { changes?: number } }
export interface D1Stmt {
  bind(...values: unknown[]): D1Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result<unknown>>;
}
export interface D1 {
  prepare(sql: string): D1Stmt;
  batch(statements: D1Stmt[]): Promise<D1Result<unknown>[]>;
}
