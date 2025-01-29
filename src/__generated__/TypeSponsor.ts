import type {
  ChainModifiers,
  Entry,
  EntryFieldTypes,
  EntrySkeletonType,
  LocaleCode,
} from "contentful";

export type TypeSponsorFields = {
  name: EntryFieldTypes.Symbol;
  logo?: EntryFieldTypes.AssetLink;
};

export type TypeSponsorSkeleton = EntrySkeletonType<
  TypeSponsorFields,
  "sponsor"
>;
export type TypeSponsor<
  Modifiers extends ChainModifiers,
  Locales extends LocaleCode = LocaleCode,
> = Entry<TypeSponsorSkeleton, Modifiers, Locales>;

export function isTypeSponsor<
  Modifiers extends ChainModifiers,
  Locales extends LocaleCode,
>(
  entry: Entry<EntrySkeletonType, Modifiers, Locales>,
): entry is TypeSponsor<Modifiers, Locales> {
  return entry.sys.contentType.sys.id === "sponsor";
}

export type TypeSponsorWithoutLinkResolutionResponse =
  TypeSponsor<"WITHOUT_LINK_RESOLUTION">;
export type TypeSponsorWithoutUnresolvableLinksResponse =
  TypeSponsor<"WITHOUT_UNRESOLVABLE_LINKS">;
export type TypeSponsorWithAllLocalesResponse<
  Locales extends LocaleCode = LocaleCode,
> = TypeSponsor<"WITH_ALL_LOCALES", Locales>;
export type TypeSponsorWithAllLocalesAndWithoutLinkResolutionResponse<
  Locales extends LocaleCode = LocaleCode,
> = TypeSponsor<"WITHOUT_LINK_RESOLUTION" | "WITH_ALL_LOCALES", Locales>;
export type TypeSponsorWithAllLocalesAndWithoutUnresolvableLinksResponse<
  Locales extends LocaleCode = LocaleCode,
> = TypeSponsor<"WITHOUT_UNRESOLVABLE_LINKS" | "WITH_ALL_LOCALES", Locales>;
