import type {
  ChainModifiers,
  Entry,
  EntryFieldTypes,
  EntrySkeletonType,
  LocaleCode,
} from "contentful";

export type TypeAssetLinkFields = {
  asset: EntryFieldTypes.AssetLink;
  href: EntryFieldTypes.Symbol;
}

export type TypeAssetLinkSkeleton = EntrySkeletonType<
  TypeAssetLinkFields,
  "assetLink"
>;
export type TypeAssetLink<
  Modifiers extends ChainModifiers,
  Locales extends LocaleCode = LocaleCode,
> = Entry<TypeAssetLinkSkeleton, Modifiers, Locales>;

export function isTypeAssetLink<
  Modifiers extends ChainModifiers,
  Locales extends LocaleCode,
>(
  entry: Entry<EntrySkeletonType, Modifiers, Locales>,
): entry is TypeAssetLink<Modifiers, Locales> {
  return entry.sys.contentType.sys.id === "assetLink";
}

export type TypeAssetLinkWithoutLinkResolutionResponse =
  TypeAssetLink<"WITHOUT_LINK_RESOLUTION">;
export type TypeAssetLinkWithoutUnresolvableLinksResponse =
  TypeAssetLink<"WITHOUT_UNRESOLVABLE_LINKS">;
export type TypeAssetLinkWithAllLocalesResponse<
  Locales extends LocaleCode = LocaleCode,
> = TypeAssetLink<"WITH_ALL_LOCALES", Locales>;
export type TypeAssetLinkWithAllLocalesAndWithoutLinkResolutionResponse<
  Locales extends LocaleCode = LocaleCode,
> = TypeAssetLink<"WITHOUT_LINK_RESOLUTION" | "WITH_ALL_LOCALES", Locales>;
export type TypeAssetLinkWithAllLocalesAndWithoutUnresolvableLinksResponse<
  Locales extends LocaleCode = LocaleCode,
> = TypeAssetLink<"WITHOUT_UNRESOLVABLE_LINKS" | "WITH_ALL_LOCALES", Locales>;
