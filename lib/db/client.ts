import postgres from 'postgres'

let _sql: ReturnType<typeof postgres> | null = null

function getSql() {
  if (!_sql) {
    _sql = postgres(process.env.DATABASE_URL!, { max: 5 })
  }
  return _sql
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
type Cond = { col: string; op: string; val: unknown }
type QueryResult = { data: any; error: { message: string } | null; count?: number }

class Query {
  private _table: string
  private _op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private _conditions: Cond[] = []
  private _single = false
  private _countOnly = false
  private _returning = false
  private _limit?: number
  private _payload?: Row
  private _orderCol?: string
  private _orderDir: 'ASC' | 'DESC' = 'ASC'

  constructor(table: string) {
    this._table = table
  }

  select(_cols = '*', opts?: { count?: 'exact'; head?: boolean }) {
    if (this._op === 'select') {
      // initial select
    } else {
      // chained after insert/update — means "return the row"
      this._returning = true
      return this
    }
    this._op = 'select'
    if (opts?.count === 'exact') this._countOnly = true
    return this
  }

  insert(payload: Row) { this._op = 'insert'; this._payload = payload; return this }
  update(payload: Row) { this._op = 'update'; this._payload = payload; return this }
  delete() { this._op = 'delete'; return this }
  upsert(payload: Row) { this._op = 'upsert'; this._payload = payload; return this }

  eq(col: string, val: unknown) { this._conditions.push({ col, op: '=', val }); return this }
  gt(col: string, val: unknown) { this._conditions.push({ col, op: '>', val }); return this }
  gte(col: string, val: unknown) { this._conditions.push({ col, op: '>=', val }); return this }

  order(col: string, opts?: { ascending?: boolean }) {
    this._orderCol = col
    this._orderDir = opts?.ascending === false ? 'DESC' : 'ASC'
    return this
  }

  limit(n: number) { this._limit = n; return this }
  single() { this._single = true; this._limit = 1; return this }

  then<T>(
    onfulfilled: (value: QueryResult) => T,
    onrejected?: ((reason: unknown) => T) | null
  ): Promise<T> {
    return this._execute().then(onfulfilled, onrejected ?? undefined)
  }

  private buildWhere(offset = 0): { clause: string; vals: unknown[] } {
    if (!this._conditions.length) return { clause: '', vals: [] }
    const parts = this._conditions.map((c, i) => `"${c.col}" ${c.op} $${offset + i + 1}`)
    return { clause: `WHERE ${parts.join(' AND ')}`, vals: this._conditions.map((c) => c.val) }
  }

  private async _execute(): Promise<QueryResult> {
    const sql = getSql()
    const t = this._table

    try {
      if (this._op === 'select') {
        const { clause, vals } = this.buildWhere()
        if (this._countOnly) {
          const rows = await sql.unsafe(`SELECT COUNT(*) as count FROM "${t}" ${clause}`, vals as never[])
          return { data: null, error: null, count: Number(rows[0]?.count ?? 0) }
        }
        const orderClause = this._orderCol ? `ORDER BY "${this._orderCol}" ${this._orderDir}` : ''
        const limitClause = this._limit ? `LIMIT ${this._limit}` : ''
        const rows = await sql.unsafe(
          `SELECT * FROM "${t}" ${clause} ${orderClause} ${limitClause}`,
          vals as never[]
        )
        return { data: this._single ? (rows[0] ?? null) : rows, error: null }
      }

      if (this._op === 'insert') {
        const p = this._payload!
        const keys = Object.keys(p)
        const cols = keys.map((k) => `"${k}"`).join(', ')
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
        const rows = await sql.unsafe(
          `INSERT INTO "${t}" (${cols}) VALUES (${placeholders}) RETURNING *`,
          keys.map((k) => p[k]) as never[]
        )
        return { data: rows[0] ?? null, error: null }
      }

      if (this._op === 'update') {
        const p = this._payload!
        const keys = Object.keys(p)
        const set = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ')
        const { clause, vals } = this.buildWhere(keys.length)
        const returning = this._returning || this._single ? 'RETURNING *' : ''
        const rows = await sql.unsafe(
          `UPDATE "${t}" SET ${set} ${clause} ${returning}`,
          [...keys.map((k) => p[k]), ...vals] as never[]
        )
        return { data: this._single ? (rows[0] ?? null) : null, error: null }
      }

      if (this._op === 'delete') {
        const { clause, vals } = this.buildWhere()
        await sql.unsafe(`DELETE FROM "${t}" ${clause}`, vals as never[])
        return { data: null, error: null }
      }

      if (this._op === 'upsert') {
        const p = this._payload!
        const keys = Object.keys(p)
        const cols = keys.map((k) => `"${k}"`).join(', ')
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
        const updateSet = keys
          .filter((k) => k !== 'user_id' && k !== 'id')
          .map((k) => `"${k}" = EXCLUDED."${k}"`)
          .join(', ')
        const returning = this._returning || this._single ? 'RETURNING *' : ''
        const rows = await sql.unsafe(
          `INSERT INTO "${t}" (${cols}) VALUES (${placeholders})
           ON CONFLICT (user_id) DO UPDATE SET ${updateSet} ${returning}`,
          keys.map((k) => p[k]) as never[]
        )
        return { data: this._single ? (rows[0] ?? null) : (rows ?? null), error: null }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { data: null, error: { message } }
    }

    return { data: null, error: null }
  }
}

export const db = { from: (table: string) => new Query(table) }

// Raw SQL helper for complex joins
export async function rawQuery<T = Row>(query: string, values: unknown[] = []): Promise<T[]> {
  const sql = getSql()
  return sql.unsafe(query, values as never[]) as unknown as T[]
}
