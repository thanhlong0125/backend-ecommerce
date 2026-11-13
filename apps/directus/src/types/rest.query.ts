export interface RestQuery {
  filter?: RestQueryFilter;
  search?: string;
  sort?: string | string[];
  limit?: number;
  offset?: number;
  page?: number;
  deep?: Record<string, unknown>;
  backlink?: boolean;
  fields?: string | string[];
}

export interface RestQueryFilter {
  [key: string]: unknown;
  _or?: RestQueryFilter[];
  _and?: RestQueryFilter[];
}

export interface BodyUpdateMany {
  keys?: string[];
  query?: RestQuery;
  data: Record<string, unknown>;
}

export interface BodyDeleteMany {
  keys?: string[];
  query?: RestQuery;
}
