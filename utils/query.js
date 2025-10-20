// utils/query.js

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Convert bracket operators from a (possibly nested) query object into
 * a Mongo condition object. Supports:
 *   - gt, gte, lt, lte, ne, in, nin, eq
 *   - Arrays for "in"/"nin" split by comma
 *   - Coercion for dateFields/numberFields
 */
const opsMap = {
  gt: '$gt',
  gte: '$gte',
  lt: '$lt',
  lte: '$lte',
  ne: '$ne',
  in: '$in',
  nin: '$nin',
  eq: '$eq',
};

function coerceValue(field, val, dateFields, numberFields) {
  if (dateFields.has(field)) {
    const coerce = (v) => new Date(v);
    return Array.isArray(val) ? val.map(coerce) : coerce(val);
  }
  if (numberFields.has(field)) {
    const coerce = (v) => Number(v);
    return Array.isArray(val) ? val.map(coerce) : coerce(val);
  }
  return val;
}

function ensureArray(val) {
  if (Array.isArray(val)) return val;
  if (val == null) return [];
  return String(val)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

exports.buildBracketFilter = (query, opts = {}) => {
  const dateFields = new Set(opts.dateFields || []);
  const numberFields = new Set(opts.numberFields || []);
  const arrayFields = new Set(opts.arrayFields || []);

  const out = {};

  // Walk top-level keys. Some values may be nested objects like { field: { gte: '...' } }
  for (const [field, value] of Object.entries(query)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;

    // Look for operator keys inside the nested object
    const entries = Object.entries(value).filter(([op]) => opsMap[op]);
    if (entries.length === 0) continue;

    for (const [op, raw] of entries) {
      let v = raw;

      if (op === 'in' || op === 'nin') {
        v = ensureArray(v);
        // Case-insensitive list membership for genres
        if (field === 'genres') {
          v = v.map((val) => new RegExp(`^${escapeRegex(val)}$`, 'i'));
        }
      }

      v = coerceValue(field, v, dateFields, numberFields);

      const mongoOp = opsMap[op];
      out[field] = out[field] || {};
      out[field][mongoOp] = v;

      // If designated as "arrayField" and op is eq, treat as $in with single-value
      if (arrayFields.has(field) && mongoOp === '$eq') {
        out[field] = { $in: [v] };
      }
    }
  }

  return out;
};

/**
 * Friendly filters → Mongo query
 *
 * Supports:
 *  - name|title (case-insensitive contains) -> title regex
 *  - studio (case-insensitive exact)        -> distributor regex ^...$
 *  - genre  (case-insensitive in array)     -> genres $elemMatch /.../i
 *  - releaseDateStart/End (ISO or yyyy-mm-dd) -> releaseDate $gte/$lte
 */
exports.buildFriendlyMovieFilter = (query) => {
  const q = {};
  const { name, title, studio, genre, releaseDateStart, releaseDateEnd } =
    query;

  const term = (title || name || '').trim();
  if (term) q.title = { $regex: escapeRegex(term), $options: 'i' };

  if (studio && String(studio).trim()) {
    const s = String(studio).trim();
    q.distributor = { $regex: `^${escapeRegex(s)}$`, $options: 'i' };
  }

  // ---- robust genre matching: match array "genres" OR single "genre" field ----
  if (genre && String(genre).trim()) {
    const g = String(genre).trim();
    const re = new RegExp(`^${escapeRegex(g)}$`, 'i');

    q.$or = [
      { genres: { $elemMatch: { $regex: re } } }, // genres: ['Short', 'Western']
      { genre: { $regex: re } }, // genre: 'Western'  (if any docs use this)
    ];
  }

  if (releaseDateStart || releaseDateEnd) {
    q.releaseDate = {};
    if (releaseDateStart) q.releaseDate.$gte = new Date(releaseDateStart);
    if (releaseDateEnd) q.releaseDate.$lte = new Date(releaseDateEnd);
  }

  return q;
};

/**
 * Merge (shallow) two condition objects so that operators on the same field
 * are combined rather than overwritten.
 */
exports.mergeConditions = (base, patch) => {
  const out = { ...base };
  for (const [field, cond] of Object.entries(patch || {})) {
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      out[field] = Object.assign({}, out[field] || {}, cond);
    } else {
      out[field] = cond;
    }
  }
  return out;
};
