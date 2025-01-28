import type {
  ChainModifiers,
  Entry,
  EntryFieldTypes,
  EntrySkeletonType,
  LocaleCode,
} from "contentful";
import type { TypeTeamSkeleton } from "./TypeTeam";

export interface TypeFixtureListFields {
  team: EntryFieldTypes.EntryLink<TypeTeamSkeleton>;
  name: EntryFieldTypes.Symbol;
  season: EntryFieldTypes.Symbol;
}

export type TypeFixtureListSkeleton = EntrySkeletonType<
  TypeFixtureListFields,
  "fixtureList"
>;
export type TypeFixtureList<
  Modifiers extends ChainModifiers,
  Locales extends LocaleCode = LocaleCode,
> = Entry<TypeFixtureListSkeleton, Modifiers, Locales>;

export function isTypeFixtureList<
  Modifiers extends ChainModifiers,
  Locales extends LocaleCode,
>(
  entry: Entry<EntrySkeletonType, Modifiers, Locales>,
): entry is TypeFixtureList<Modifiers, Locales> {
  return entry.sys.contentType.sys.id === "fixtureList";
}

export type TypeFixtureListWithoutLinkResolutionResponse =
  TypeFixtureList<"WITHOUT_LINK_RESOLUTION">;
export type TypeFixtureListWithoutUnresolvableLinksResponse =
  TypeFixtureList<"WITHOUT_UNRESOLVABLE_LINKS">;
export type TypeFixtureListWithAllLocalesResponse<
  Locales extends LocaleCode = LocaleCode,
> = TypeFixtureList<"WITH_ALL_LOCALES", Locales>;
export type TypeFixtureListWithAllLocalesAndWithoutLinkResolutionResponse<
  Locales extends LocaleCode = LocaleCode,
> = TypeFixtureList<"WITHOUT_LINK_RESOLUTION" | "WITH_ALL_LOCALES", Locales>;
export type TypeFixtureListWithAllLocalesAndWithoutUnresolvableLinksResponse<
  Locales extends LocaleCode = LocaleCode,
> = TypeFixtureList<"WITHOUT_UNRESOLVABLE_LINKS" | "WITH_ALL_LOCALES", Locales>;
