import type {
  ChainModifiers,
  Entry,
  EntryFieldTypes,
  EntrySkeletonType,
  LocaleCode,
} from "contentful";

export type TypeLocationFields = {
  name?: EntryFieldTypes.Symbol;
  street?: EntryFieldTypes.Symbol;
  city?: EntryFieldTypes.Symbol;
  county?: EntryFieldTypes.Symbol;
  country?: EntryFieldTypes.Symbol;
  postcode?: EntryFieldTypes.Symbol;
  coordinates?: EntryFieldTypes.Location;
}

export type TypeLocationSkeleton = EntrySkeletonType<
  TypeLocationFields,
  "location"
>;
export type TypeLocation<
  Modifiers extends ChainModifiers,
  Locales extends LocaleCode = LocaleCode,
> = Entry<TypeLocationSkeleton, Modifiers, Locales>;

export function isTypeLocation<
  Modifiers extends ChainModifiers,
  Locales extends LocaleCode,
>(
  entry: Entry<EntrySkeletonType, Modifiers, Locales>,
): entry is TypeLocation<Modifiers, Locales> {
  return entry.sys.contentType.sys.id === "location";
}

export type TypeLocationWithoutLinkResolutionResponse =
  TypeLocation<"WITHOUT_LINK_RESOLUTION">;
export type TypeLocationWithoutUnresolvableLinksResponse =
  TypeLocation<"WITHOUT_UNRESOLVABLE_LINKS">;
export type TypeLocationWithAllLocalesResponse<
  Locales extends LocaleCode = LocaleCode,
> = TypeLocation<"WITH_ALL_LOCALES", Locales>;
export type TypeLocationWithAllLocalesAndWithoutLinkResolutionResponse<
  Locales extends LocaleCode = LocaleCode,
> = TypeLocation<"WITHOUT_LINK_RESOLUTION" | "WITH_ALL_LOCALES", Locales>;
export type TypeLocationWithAllLocalesAndWithoutUnresolvableLinksResponse<
  Locales extends LocaleCode = LocaleCode,
> = TypeLocation<"WITHOUT_UNRESOLVABLE_LINKS" | "WITH_ALL_LOCALES", Locales>;
