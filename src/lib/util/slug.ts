export type Sluggable = {
  fields?: {
    title?: string;
    parent?: Sluggable;
    slug: string;
  };
};

export const slugup = (page: Sluggable): string => {
  if (!page.fields?.parent || !("fields" in page.fields.parent)) {
    return page.fields?.slug ?? "";
  }

  return `${slugup(page.fields.parent)}/${page.fields.slug}`;
};
