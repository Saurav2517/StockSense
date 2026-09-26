/**
 * Minimal in-memory stand-in for the supabase-js client used by the UI tests.
 * It supports the PostgREST builder methods the services actually use
 * (select / insert / update / delete + eq, neq, in, gt, gte, lt, lte, ilike,
 * contains, or, order, limit, single, maybeSingle) and `rpc` / `auth`.
 *
 * Embedded resources are NOT resolved from the select string: fixture rows are
 * stored already nested (e.g. a location row carries `warehouse: {code,name}`).
 */
function matchIlike(value, pattern) {
  const re = new RegExp('^' + String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i');
  return re.test(String(value ?? ''));
}

function makeFilter(op, col, val) {
  switch (op) {
    case 'eq':
      return (r) => String(r[col]) === String(val);
    case 'neq':
      return (r) => String(r[col]) !== String(val);
    case 'in':
      return (r) => val.map(String).includes(String(r[col]));
    case 'gt':
      return (r) => r[col] > val;
    case 'gte':
      return (r) => r[col] >= val;
    case 'lt':
      return (r) => r[col] < val;
    case 'lte':
      return (r) => r[col] <= val;
    case 'is':
      return (r) => r[col] === val;
    case 'ilike':
      return (r) => matchIlike(r[col], val);
    case 'contains':
      return (r) => Array.isArray(r[col]) && val.every((v) => r[col].includes(v));
    default:
      throw new Error(`fakeSupabase: unsupported filter ${op}`);
  }
}

/** Parses PostgREST `or` strings like `a.eq.1,b.ilike.%x%` (no nesting). */
function parseOr(expr) {
  const parts = expr.split(',').map((p) => {
    const [col, op, ...rest] = p.split('.');
    return makeFilter(op, col, rest.join('.'));
  });
  return (r) => parts.some((f) => f(r));
}

class Builder {
  constructor(db, table, log) {
    this.db = db;
    this.table = table;
    this.log = log;
    this.filters = [];
    this.mode = 'select';
    this.orderBy = null;
    this.limitN = null;
    this.wantSingle = false;
    this.wantMaybe = false;
    this.values = null;
  }
  select() {
    if (this.mode === 'select') this.mode = 'select';
    return this;
  }
  insert(values) {
    this.mode = 'insert';
    this.values = values;
    return this;
  }
  update(values) {
    this.mode = 'update';
    this.values = values;
    return this;
  }
  delete() {
    this.mode = 'delete';
    return this;
  }
  eq(c, v) { this.filters.push(makeFilter('eq', c, v)); return this; }
  neq(c, v) { this.filters.push(makeFilter('neq', c, v)); return this; }
  in(c, v) { this.filters.push(makeFilter('in', c, v)); return this; }
  gt(c, v) { this.filters.push(makeFilter('gt', c, v)); return this; }
  gte(c, v) { this.filters.push(makeFilter('gte', c, v)); return this; }
  lt(c, v) { this.filters.push(makeFilter('lt', c, v)); return this; }
  lte(c, v) { this.filters.push(makeFilter('lte', c, v)); return this; }
  is(c, v) { this.filters.push(makeFilter('is', c, v)); return this; }
  ilike(c, v) { this.filters.push(makeFilter('ilike', c, v)); return this; }
  contains(c, v) { this.filters.push(makeFilter('contains', c, v)); return this; }
  or(expr) { this.filters.push(parseOr(expr)); return this; }
  order(col, { ascending = true } = {}) { this.orderBy = { col, ascending }; return this; }
  limit(n) { this.limitN = n; return this; }
  single() { this.wantSingle = true; return this; }
  maybeSingle() { this.wantMaybe = true; return this; }

  execute() {
    const rows = this.db[this.table];
    if (!rows) return { data: null, error: { message: `relation "${this.table}" does not exist`, code: '42P01' } };
    const matches = (r) => this.filters.every((f) => f(r));
    let result;
    if (this.mode === 'insert') {
      const list = (Array.isArray(this.values) ? this.values : [this.values]).map((v) => ({
        id: v.id || `new-${this.table}-${rows.length + 1}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...v,
      }));
      rows.push(...list);
      this.log.push({ kind: 'insert', table: this.table, values: this.values });
      result = list;
    } else if (this.mode === 'update') {
      result = rows.filter(matches).map((r) => Object.assign(r, this.values, { updated_at: new Date().toISOString() }));
      this.log.push({ kind: 'update', table: this.table, values: this.values });
    } else if (this.mode === 'delete') {
      result = rows.filter(matches);
      this.db[this.table] = rows.filter((r) => !matches(r));
      this.log.push({ kind: 'delete', table: this.table });
    } else {
      result = rows.filter(matches);
      if (this.orderBy) {
        const { col, ascending } = this.orderBy;
        result = [...result].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (ascending ? 1 : -1));
      }
      if (this.limitN != null) result = result.slice(0, this.limitN);
    }
    // Like a real API, hand out copies so in-place fixture mutations never leak into React Query's cache.
    result = structuredClone(result);
    if (this.wantSingle || this.wantMaybe) {
      if (result.length === 0) {
        return this.wantMaybe ? { data: null, error: null } : { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } };
      }
      return { data: result[0], error: null };
    }
    return { data: result, error: null };
  }
  then(resolve, reject) {
    return Promise.resolve().then(() => this.execute()).then(resolve, reject);
  }
}

export function createFakeSupabase({ db, rpc = {}, session = null, auth = {} }) {
  const log = [];
  const rpcCalls = [];
  const authCalls = [];
  const listeners = new Set();
  let currentSession = session;

  const client = {
    __log: log,
    __rpcCalls: rpcCalls,
    __authCalls: authCalls,
    __db: db,
    from: (table) => new Builder(db, table, log),
    rpc: (name, args) => {
      rpcCalls.push({ name, args });
      const handler = rpc[name];
      return Promise.resolve().then(() => {
        if (!handler) return { data: null, error: { message: `function ${name} does not exist`, code: '42883' } };
        try {
          const data = handler(args, { db, client });
          return { data, error: null };
        } catch (err) {
          return { data: null, error: { message: err.message, code: err.code || 'P0001' } };
        }
      });
    },
    auth: {
      getSession: async () => ({ data: { session: currentSession }, error: null }),
      onAuthStateChange: (cb) => {
        listeners.add(cb);
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
      },
      signInWithPassword: async (creds) => {
        authCalls.push({ name: 'signInWithPassword', args: creds });
        if (auth.signInWithPassword) return auth.signInWithPassword(creds);
        return { data: { session: null, user: null }, error: { message: 'Invalid login credentials' } };
      },
      // Supabase default ("Confirm email" ON): user created, no session until the link is opened.
      signUp: async (args) => {
        authCalls.push({ name: 'signUp', args });
        return auth.signUp ? auth.signUp(args) : { data: { user: { id: 'u-new', identities: [{ id: 'i-1' }] }, session: null }, error: null };
      },
      resend: async (args) => {
        authCalls.push({ name: 'resend', args });
        return auth.resend ? auth.resend(args) : { data: {}, error: null };
      },
      signOut: async () => {
        currentSession = null;
        listeners.forEach((cb) => cb('SIGNED_OUT', null));
        return { error: null };
      },
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      verifyOtp: async () => ({ data: { session: currentSession }, error: null }),
      updateUser: async () => ({ data: { user: currentSession?.user }, error: null }),
    },
    __emit: (event, s) => {
      currentSession = s;
      listeners.forEach((cb) => cb(event, s));
    },
  };
  return client;
}
