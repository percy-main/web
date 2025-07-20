import type { ChainModifiers, Entry, EntryFieldTypes, EntrySkeletonType, LocaleCode } from "contentful";

export interface TypeEmailCollectorFields {
    meta: EntryFieldTypes.Object;
    title: EntryFieldTypes.Symbol;
    description?: EntryFieldTypes.Text;
}

export type TypeEmailCollectorSkeleton = EntrySkeletonType<TypeEmailCollectorFields, "emailCollector">;
export type TypeEmailCollector<Modifiers extends ChainModifiers, Locales extends LocaleCode = LocaleCode> = Entry<TypeEmailCollectorSkeleton, Modifiers, Locales>;

export function isTypeEmailCollector<Modifiers extends ChainModifiers, Locales extends LocaleCode>(entry: Entry<EntrySkeletonType, Modifiers, Locales>): entry is TypeEmailCollector<Modifiers, Locales> {
    return entry.sys.contentType.sys.id === 'emailCollector'
}

export type TypeEmailCollectorWithoutLinkResolutionResponse = TypeEmailCollector<"WITHOUT_LINK_RESOLUTION">;
export type TypeEmailCollectorWithoutUnresolvableLinksResponse = TypeEmailCollector<"WITHOUT_UNRESOLVABLE_LINKS">;
export type TypeEmailCollectorWithAllLocalesResponse<Locales extends LocaleCode = LocaleCode> = TypeEmailCollector<"WITH_ALL_LOCALES", Locales>;
export type TypeEmailCollectorWithAllLocalesAndWithoutLinkResolutionResponse<Locales extends LocaleCode = LocaleCode> = TypeEmailCollector<"WITHOUT_LINK_RESOLUTION" | "WITH_ALL_LOCALES", Locales>;
export type TypeEmailCollectorWithAllLocalesAndWithoutUnresolvableLinksResponse<Locales extends LocaleCode = LocaleCode> = TypeEmailCollector<"WITHOUT_UNRESOLVABLE_LINKS" | "WITH_ALL_LOCALES", Locales>;
