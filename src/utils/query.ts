// src/utils/query.ts

export function parseSort(
  sortQuery: string | undefined,
  defaultSort = '-createdAt'
) {
  return sortQuery || defaultSort;
}

export function buildSearchFilter(
  searchTerm: string | undefined,
  fields: string[]
) {
  if (!searchTerm) return {};

  const regex = new RegExp(searchTerm, 'i');
  return {
    $or: fields.map((field) => ({ [field]: regex })),
  };
}

export function buildBracketFilter(
  query: any,
  options?: { dateFields?: string[]; arrayFields?: string[] }
) {
  const bracket = query.bracket;
  if (!bracket) return {};
  return { bracket: parseInt(bracket) };
}
export function buildFriendlyMovieFilter(query: any) {
  const filter: any = {};

  if (query.genre) filter.genre = query.genre;
  if (query.studio) filter.studio = query.studio;
  if (query.year) filter.releaseYear = parseInt(query.year);

  return filter;
}

export function mergeConditions(...conditions: any[]) {
  const merged: any = {};

  for (const condition of conditions) {
    Object.assign(merged, condition);
  }

  return merged;
}
