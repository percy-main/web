import type { ChainModifiers, Entry, EntryFieldTypes, EntrySkeletonType, LocaleCode } from "contentful";
import type { TypePageSkeleton } from "./TypePage";
import type { TypeTrusteeSkeleton } from "./TypeTrustee";

export interface TypeNewsFields {
    title: EntryFieldTypes.Symbol;
    content: EntryFieldTypes.RichText;
    summary: EntryFieldTypes.RichText;
    author?: EntryFieldTypes.EntryLink<TypeTrusteeSkeleton>;
    pages?: EntryFieldTypes.Array<EntryFieldTypes.EntryLink<TypePageSkeleton>>;
    slug: EntryFieldTypes.Symbol;
}

export type TypeNewsSkeleton = EntrySkeletonType<TypeNewsFields, "news">;
export type TypeNews<Modifiers extends ChainModifiers, Locales extends LocaleCode = LocaleCode> = Entry<TypeNewsSkeleton, Modifiers, Locales>;

export function isTypeNews<Modifiers extends ChainModifiers, Locales extends LocaleCode>(entry: Entry<EntrySkeletonType, Modifiers, Locales>): entry is TypeNews<Modifiers, Locales> {
    return entry.sys.contentType.sys.id === 'news'
}

export type TypeNewsWithoutLinkResolutionResponse = TypeNews<"WITHOUT_LINK_RESOLUTION">;
export type TypeNewsWithoutUnresolvableLinksResponse = TypeNews<"WITHOUT_UNRESOLVABLE_LINKS">;
export type TypeNewsWithAllLocalesResponse<Locales extends LocaleCode = LocaleCode> = TypeNews<"WITH_ALL_LOCALES", Locales>;
export type TypeNewsWithAllLocalesAndWithoutLinkResolutionResponse<Locales extends LocaleCode = LocaleCode> = TypeNews<"WITHOUT_LINK_RESOLUTION" | "WITH_ALL_LOCALES", Locales>;
export type TypeNewsWithAllLocalesAndWithoutUnresolvableLinksResponse<Locales extends LocaleCode = LocaleCode> = TypeNews<"WITHOUT_UNRESOLVABLE_LINKS" | "WITH_ALL_LOCALES", Locales>;
