import type { ChainModifiers, Entry, EntryFieldTypes, EntrySkeletonType, LocaleCode } from "contentful";
import type { TypeLeagueSkeleton } from "./TypeLeague";
import type { TypeTeamSkeleton } from "./TypeTeam";

export interface TypeGameFields {
    opposition: EntryFieldTypes.Symbol;
    home: EntryFieldTypes.Boolean;
    when: EntryFieldTypes.Date;
    team: EntryFieldTypes.EntryLink<TypeTeamSkeleton>;
    league: EntryFieldTypes.EntryLink<TypeLeagueSkeleton>;
}

export type TypeGameSkeleton = EntrySkeletonType<TypeGameFields, "game">;
export type TypeGame<Modifiers extends ChainModifiers, Locales extends LocaleCode = LocaleCode> = Entry<TypeGameSkeleton, Modifiers, Locales>;

export function isTypeGame<Modifiers extends ChainModifiers, Locales extends LocaleCode>(entry: Entry<EntrySkeletonType, Modifiers, Locales>): entry is TypeGame<Modifiers, Locales> {
    return entry.sys.contentType.sys.id === 'game'
}

export type TypeGameWithoutLinkResolutionResponse = TypeGame<"WITHOUT_LINK_RESOLUTION">;
export type TypeGameWithoutUnresolvableLinksResponse = TypeGame<"WITHOUT_UNRESOLVABLE_LINKS">;
export type TypeGameWithAllLocalesResponse<Locales extends LocaleCode = LocaleCode> = TypeGame<"WITH_ALL_LOCALES", Locales>;
export type TypeGameWithAllLocalesAndWithoutLinkResolutionResponse<Locales extends LocaleCode = LocaleCode> = TypeGame<"WITHOUT_LINK_RESOLUTION" | "WITH_ALL_LOCALES", Locales>;
export type TypeGameWithAllLocalesAndWithoutUnresolvableLinksResponse<Locales extends LocaleCode = LocaleCode> = TypeGame<"WITHOUT_UNRESOLVABLE_LINKS" | "WITH_ALL_LOCALES", Locales>;
