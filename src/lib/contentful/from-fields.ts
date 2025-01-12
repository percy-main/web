/**
 * Removes some type safety to deal with poor Contentful type gen
 * @param data Contentful data
 * @returns Data fields
 */
export const fromFields = (data: any) => data.fields;
