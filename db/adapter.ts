/** Parameterized SQL interface shared by the app and PostgreSQL tests. */
export type Row = Record<string, unknown>;
export type QueryResult = { rows: Row[]; rowCount: number | null };
export type Isolation = 'read committed' | 'repeatable read';
export interface Transport {
  query(text: string, values: unknown[]): Promise<QueryResult>;
  transaction<T>(work: (transport: Transport) => Promise<T>, isolation?: Isolation): Promise<T>;
}
export type Result<T = Row> = { results: T[]; meta: { changes: number } };
export class Statement {
  constructor(readonly db: Database, readonly text: string, readonly values: unknown[] = []) {}
  bind(...values: unknown[]) { return new Statement(this.db, this.text, values); }
  async all<T = Row>(): Promise<Result<T>> { return this.db.execute<T>(this); }
  async first<T = Row>(): Promise<T | null> { return (await this.all<T>()).results[0] ?? null; }
  async run() { return this.all(); }
}
export class Database {
  constructor(private readonly transport: Transport) {}
  prepare(text: string) { return new Statement(this, text); }
  async execute<T = Row>(statement: Statement): Promise<Result<T>> {
    const result = await this.transport.query(statement.text, statement.values);
    return { results: result.rows as T[], meta: { changes: result.rowCount ?? 0 } };
  }
  async transaction<T>(work: (db: Database) => Promise<T>, isolation: Isolation = 'read committed'): Promise<T> {
    return this.transport.transaction(tx => work(new Database(tx)), isolation);
  }
  async batch(statements: Statement[]) {
    return this.transaction(async tx => {
      const result: Result[] = [];
      for (const statement of statements) result.push(await tx.execute(statement));
      return result;
    });
  }
  /** Coordinates writes across Vercel instances; must run inside a transaction. */
  async lock(scope: string, userId: string) {
    await this.prepare('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))').bind(`${scope}:${userId}`).run();
  }
}
