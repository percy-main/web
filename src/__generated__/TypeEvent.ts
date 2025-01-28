import type {
  ChainModifiers,
  Entry,
  EntryFieldTypes,
  EntrySkeletonType,
  LocaleCode,
} from "contentful";
import type { TypeLocationSkeleton } from "./TypeLocation";

export interface TypeEventFields {
  name: EntryFieldTypes.Symbol;
  description: EntryFieldTypes.RichText;
  when: EntryFieldTypes.Date;
  finish?: EntryFieldTypes.Date;
  location?: EntryFieldTypes.EntryLink<TypeLocationSkeleton>;
}

export type TypeEventSkeleton = EntrySkeletonType<TypeEventFields, "event">;
export type TypeEvent<
  Modifiers extends ChainModifiers,
  Locales extends LocaleCode = LocaleCode,
> = Entry<TypeEventSkeleton, Modifiers, Locales>;

export function isTypeEvent<
  Modifiers extends ChainModifiers,
  Locales extends LocaleCode,
>(
  entry: Entry<EntrySkeletonType, Modifiers, Locales>,
): entry is TypeEvent<Modifiers, Locales> {
  return entry.sys.contentType.sys.id === "event";
}

export type TypeEventWithoutLinkResolutionResponse =
  TypeEvent<"WITHOUT_LINK_RESOLUTION">;
export type TypeEventWithoutUnresolvableLinksResponse =
  TypeEvent<"WITHOUT_UNRESOLVABLE_LINKS">;
export type TypeEventWithAllLocalesResponse<
  Locales extends LocaleCode = LocaleCode,
> = TypeEvent<"WITH_ALL_LOCALES", Locales>;
export type TypeEventWithAllLocalesAndWithoutLinkResolutionResponse<
  Locales extends LocaleCode = LocaleCode,
> = TypeEvent<"WITHOUT_LINK_RESOLUTION" | "WITH_ALL_LOCALES", Locales>;
export type TypeEventWithAllLocalesAndWithoutUnresolvableLinksResponse<
  Locales extends LocaleCode = LocaleCode,
> = TypeEvent<"WITHOUT_UNRESOLVABLE_LINKS" | "WITH_ALL_LOCALES", Locales>;
