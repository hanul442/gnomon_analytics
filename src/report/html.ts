// Shared HTML escaping for server-rendered pages. No imports, so any module can use it without a cycle.

const ENTITY: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Text and attribute values: &, <, >, " and ' become entities. */
export const esc = (value: string): string => value.replace(/[&<>"']/g, (c) => ENTITY[c]!);
