import type { ChainModifiers, Entry, EntryFieldTypes, EntrySkeletonType, LocaleCode } from "contentful";

export interface TypeSiteDataFields {
    mIssion: EntryFieldTypes.Text;
}

export type TypeSiteDataSkeleton = EntrySkeletonType<TypeSiteDataFields, "siteData">;
export type TypeSiteData<Modifiers extends ChainModifiers, Locales extends LocaleCode = LocaleCode> = Entry<TypeSiteDataSkeleton, Modifiers, Locales>;

export function isTypeSiteData<Modifiers extends ChainModifiers, Locales extends LocaleCode>(entry: Entry<EntrySkeletonType, Modifiers, Locales>): entry is TypeSiteData<Modifiers, Locales> {
    return entry.sys.contentType.sys.id === 'siteData'
}

export type TypeSiteDataWithoutLinkResolutionResponse = TypeSiteData<"WITHOUT_LINK_RESOLUTION">;
export type TypeSiteDataWithoutUnresolvableLinksResponse = TypeSiteData<"WITHOUT_UNRESOLVABLE_LINKS">;
export type TypeSiteDataWithAllLocalesResponse<Locales extends LocaleCode = LocaleCode> = TypeSiteData<"WITH_ALL_LOCALES", Locales>;
export type TypeSiteDataWithAllLocalesAndWithoutLinkResolutionResponse<Locales extends LocaleCode = LocaleCode> = TypeSiteData<"WITHOUT_LINK_RESOLUTION" | "WITH_ALL_LOCALES", Locales>;
export type TypeSiteDataWithAllLocalesAndWithoutUnresolvableLinksResponse<Locales extends LocaleCode = LocaleCode> = TypeSiteData<"WITHOUT_UNRESOLVABLE_LINKS" | "WITH_ALL_LOCALES", Locales>;
