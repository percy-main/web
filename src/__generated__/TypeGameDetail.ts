import type { ChainModifiers, Entry, EntryFieldTypes, EntrySkeletonType, LocaleCode } from "contentful";
import type { TypeSponsorSkeleton } from "./TypeSponsor";

export interface TypeGameDetailFields {
    name?: EntryFieldTypes.Symbol;
    playCricketId: EntryFieldTypes.Symbol;
    sponsor?: EntryFieldTypes.EntryLink<TypeSponsorSkeleton>;
    description?: EntryFieldTypes.RichText;
    report?: EntryFieldTypes.RichText;
    slug?: EntryFieldTypes.Symbol;
}

export type TypeGameDetailSkeleton = EntrySkeletonType<TypeGameDetailFields, "gameDetail">;
export type TypeGameDetail<Modifiers extends ChainModifiers, Locales extends LocaleCode = LocaleCode> = Entry<TypeGameDetailSkeleton, Modifiers, Locales>;

export function isTypeGameDetail<Modifiers extends ChainModifiers, Locales extends LocaleCode>(entry: Entry<EntrySkeletonType, Modifiers, Locales>): entry is TypeGameDetail<Modifiers, Locales> {
    return entry.sys.contentType.sys.id === 'gameDetail'
}

export type TypeGameDetailWithoutLinkResolutionResponse = TypeGameDetail<"WITHOUT_LINK_RESOLUTION">;
export type TypeGameDetailWithoutUnresolvableLinksResponse = TypeGameDetail<"WITHOUT_UNRESOLVABLE_LINKS">;
export type TypeGameDetailWithAllLocalesResponse<Locales extends LocaleCode = LocaleCode> = TypeGameDetail<"WITH_ALL_LOCALES", Locales>;
export type TypeGameDetailWithAllLocalesAndWithoutLinkResolutionResponse<Locales extends LocaleCode = LocaleCode> = TypeGameDetail<"WITHOUT_LINK_RESOLUTION" | "WITH_ALL_LOCALES", Locales>;
export type TypeGameDetailWithAllLocalesAndWithoutUnresolvableLinksResponse<Locales extends LocaleCode = LocaleCode> = TypeGameDetail<"WITHOUT_UNRESOLVABLE_LINKS" | "WITH_ALL_LOCALES", Locales>;
