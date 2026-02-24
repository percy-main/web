import type { ChainModifiers, Entry, EntryFieldTypes, EntrySkeletonType, LocaleCode } from "contentful";

export interface TypeContactFormFields {
    title: EntryFieldTypes.Symbol;
    description?: EntryFieldTypes.Symbol;
}

export type TypeContactFormSkeleton = EntrySkeletonType<TypeContactFormFields, "contactForm">;
export type TypeContactForm<Modifiers extends ChainModifiers, Locales extends LocaleCode = LocaleCode> = Entry<TypeContactFormSkeleton, Modifiers, Locales>;

export function isTypeContactForm<Modifiers extends ChainModifiers, Locales extends LocaleCode>(entry: Entry<EntrySkeletonType, Modifiers, Locales>): entry is TypeContactForm<Modifiers, Locales> {
    return entry.sys.contentType.sys.id === 'contactForm'
}

export type TypeContactFormWithoutLinkResolutionResponse = TypeContactForm<"WITHOUT_LINK_RESOLUTION">;
export type TypeContactFormWithoutUnresolvableLinksResponse = TypeContactForm<"WITHOUT_UNRESOLVABLE_LINKS">;
export type TypeContactFormWithAllLocalesResponse<Locales extends LocaleCode = LocaleCode> = TypeContactForm<"WITH_ALL_LOCALES", Locales>;
export type TypeContactFormWithAllLocalesAndWithoutLinkResolutionResponse<Locales extends LocaleCode = LocaleCode> = TypeContactForm<"WITHOUT_LINK_RESOLUTION" | "WITH_ALL_LOCALES", Locales>;
export type TypeContactFormWithAllLocalesAndWithoutUnresolvableLinksResponse<Locales extends LocaleCode = LocaleCode> = TypeContactForm<"WITHOUT_UNRESOLVABLE_LINKS" | "WITH_ALL_LOCALES", Locales>;
