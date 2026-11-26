import categories from '../../../shared/schema/categories.json';

/** Category ids from shared/schema/categories.json. Do not duplicate the list. */
export const CATEGORIES: readonly string[] = categories;

export function isCategory(value: string): boolean {
  return CATEGORIES.includes(value);
}
