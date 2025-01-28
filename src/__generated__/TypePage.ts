import type {
  ChainModifiers,
  Entry,
  EntryFieldTypes,
  EntrySkeletonType,
  LocaleCode,
} from "contentful";

export interface TypePageFields {
  title: EntryFieldTypes.Symbol;
  content: EntryFieldTypes.RichText;
  mainMenuItem?: EntryFieldTypes.Boolean;
  slug: EntryFieldTypes.Symbol;
  parent?: EntryFieldTypes.EntryLink<TypePageSkeleton>;
  menuOrder?: EntryFieldTypes.Integer;
  ldjson?: EntryFieldTypes.Object;
}

export type TypePageSkeleton = EntrySkeletonType<TypePageFields, "page">;
export type TypePage<
  Modifiers extends ChainModifiers,
  Locales extends LocaleCode = LocaleCode,
> = Entry<TypePageSkeleton, Modifiers, Locales>;

export function isTypePage<
  Modifiers extends ChainModifiers,
  Locales extends LocaleCode,
>(
  entry: Entry<EntrySkeletonType, Modifiers, Locales>,
): entry is TypePage<Modifiers, Locales> {
  return entry.sys.contentType.sys.id === "page";
}

export type TypePageWithoutLinkResolutionResponse =
  TypePage<"WITHOUT_LINK_RESOLUTION">;
export type TypePageWithoutUnresolvableLinksResponse =
  TypePage<"WITHOUT_UNRESOLVABLE_LINKS">;
export type TypePageWithAllLocalesResponse<
  Locales extends LocaleCode = LocaleCode,
> = TypePage<"WITH_ALL_LOCALES", Locales>;
export type TypePageWithAllLocalesAndWithoutLinkResolutionResponse<
  Locales extends LocaleCode = LocaleCode,
> = TypePage<"WITHOUT_LINK_RESOLUTION" | "WITH_ALL_LOCALES", Locales>;
export type TypePageWithAllLocalesAndWithoutUnresolvableLinksResponse<
  Locales extends LocaleCode = LocaleCode,
> = TypePage<"WITHOUT_UNRESOLVABLE_LINKS" | "WITH_ALL_LOCALES", Locales>;
