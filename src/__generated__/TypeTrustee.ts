import type { ChainModifiers, Entry, EntryFieldTypes, EntrySkeletonType, LocaleCode } from "contentful";

export interface TypeTrusteeFields {
    name: EntryFieldTypes.Symbol;
    photo?: EntryFieldTypes.AssetLink;
    position?: EntryFieldTypes.Symbol;
    pageData?: EntryFieldTypes.Object;
}

export type TypeTrusteeSkeleton = EntrySkeletonType<TypeTrusteeFields, "trustee">;
export type TypeTrustee<Modifiers extends ChainModifiers, Locales extends LocaleCode = LocaleCode> = Entry<TypeTrusteeSkeleton, Modifiers, Locales>;

export function isTypeTrustee<Modifiers extends ChainModifiers, Locales extends LocaleCode>(entry: Entry<EntrySkeletonType, Modifiers, Locales>): entry is TypeTrustee<Modifiers, Locales> {
    return entry.sys.contentType.sys.id === 'trustee'
}

export type TypeTrusteeWithoutLinkResolutionResponse = TypeTrustee<"WITHOUT_LINK_RESOLUTION">;
export type TypeTrusteeWithoutUnresolvableLinksResponse = TypeTrustee<"WITHOUT_UNRESOLVABLE_LINKS">;
export type TypeTrusteeWithAllLocalesResponse<Locales extends LocaleCode = LocaleCode> = TypeTrustee<"WITH_ALL_LOCALES", Locales>;
export type TypeTrusteeWithAllLocalesAndWithoutLinkResolutionResponse<Locales extends LocaleCode = LocaleCode> = TypeTrustee<"WITHOUT_LINK_RESOLUTION" | "WITH_ALL_LOCALES", Locales>;
export type TypeTrusteeWithAllLocalesAndWithoutUnresolvableLinksResponse<Locales extends LocaleCode = LocaleCode> = TypeTrustee<"WITHOUT_UNRESOLVABLE_LINKS" | "WITH_ALL_LOCALES", Locales>;
