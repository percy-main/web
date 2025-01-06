import type { ChainModifiers, Entry, EntryFieldTypes, EntrySkeletonType, LocaleCode } from "contentful";

export interface TypeLeagueFields {
    name: EntryFieldTypes.Symbol;
}

export type TypeLeagueSkeleton = EntrySkeletonType<TypeLeagueFields, "league">;
export type TypeLeague<Modifiers extends ChainModifiers, Locales extends LocaleCode = LocaleCode> = Entry<TypeLeagueSkeleton, Modifiers, Locales>;

export function isTypeLeague<Modifiers extends ChainModifiers, Locales extends LocaleCode>(entry: Entry<EntrySkeletonType, Modifiers, Locales>): entry is TypeLeague<Modifiers, Locales> {
    return entry.sys.contentType.sys.id === 'league'
}

export type TypeLeagueWithoutLinkResolutionResponse = TypeLeague<"WITHOUT_LINK_RESOLUTION">;
export type TypeLeagueWithoutUnresolvableLinksResponse = TypeLeague<"WITHOUT_UNRESOLVABLE_LINKS">;
export type TypeLeagueWithAllLocalesResponse<Locales extends LocaleCode = LocaleCode> = TypeLeague<"WITH_ALL_LOCALES", Locales>;
export type TypeLeagueWithAllLocalesAndWithoutLinkResolutionResponse<Locales extends LocaleCode = LocaleCode> = TypeLeague<"WITHOUT_LINK_RESOLUTION" | "WITH_ALL_LOCALES", Locales>;
export type TypeLeagueWithAllLocalesAndWithoutUnresolvableLinksResponse<Locales extends LocaleCode = LocaleCode> = TypeLeague<"WITHOUT_UNRESOLVABLE_LINKS" | "WITH_ALL_LOCALES", Locales>;
