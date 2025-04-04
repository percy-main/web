import type { ChainModifiers, Entry, EntryFieldTypes, EntrySkeletonType, LocaleCode } from "contentful";

export interface TypeTeamFields {
    name: EntryFieldTypes.Symbol;
    teamId: EntryFieldTypes.Symbol;
}

export type TypeTeamSkeleton = EntrySkeletonType<TypeTeamFields, "team">;
export type TypeTeam<Modifiers extends ChainModifiers, Locales extends LocaleCode = LocaleCode> = Entry<TypeTeamSkeleton, Modifiers, Locales>;

export function isTypeTeam<Modifiers extends ChainModifiers, Locales extends LocaleCode>(entry: Entry<EntrySkeletonType, Modifiers, Locales>): entry is TypeTeam<Modifiers, Locales> {
    return entry.sys.contentType.sys.id === 'team'
}

export type TypeTeamWithoutLinkResolutionResponse = TypeTeam<"WITHOUT_LINK_RESOLUTION">;
export type TypeTeamWithoutUnresolvableLinksResponse = TypeTeam<"WITHOUT_UNRESOLVABLE_LINKS">;
export type TypeTeamWithAllLocalesResponse<Locales extends LocaleCode = LocaleCode> = TypeTeam<"WITH_ALL_LOCALES", Locales>;
export type TypeTeamWithAllLocalesAndWithoutLinkResolutionResponse<Locales extends LocaleCode = LocaleCode> = TypeTeam<"WITHOUT_LINK_RESOLUTION" | "WITH_ALL_LOCALES", Locales>;
export type TypeTeamWithAllLocalesAndWithoutUnresolvableLinksResponse<Locales extends LocaleCode = LocaleCode> = TypeTeam<"WITHOUT_UNRESOLVABLE_LINKS" | "WITH_ALL_LOCALES", Locales>;
