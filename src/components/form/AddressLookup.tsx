import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MAPS_API_KEY } from "astro:env/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "astro:schema";

const inputClass =
  "peer block w-full appearance-none border-0 border-b-2 border-gray-300 bg-transparent text-sm text-gray-900 focus:border-blue-600 focus:ring-0 focus:outline-none dark:border-gray-600 dark:text-white dark:focus:border-blue-500";

const labelClass =
  "absolute top-3 origin-[0] -translate-y-7 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:start-0 peer-focus:-translate-y-7 peer-focus:scale-75 peer-focus:font-medium peer-focus:text-blue-600 rtl:peer-focus:left-auto rtl:peer-focus:translate-x-1/4 dark:text-gray-400 peer-focus:dark:text-blue-500";

const addressComponentsSchema = z.object({
  houseNumber: z.string().default(""),
  street: z.string().default(""),
  town: z.string().default(""),
  postcode: z.string().default(""),
});

type AddressFields = z.infer<typeof addressComponentsSchema>;

export type AddressValue = {
  address: string;
  postcode: string;
};

type AddressLookupInnerProps = {
  onChange?: (value: AddressValue) => void;
  defaultAddress?: string;
  defaultPostcode?: string;
};

function extractAddressFields(
  place: google.maps.places.PlaceResult,
): AddressFields {
  const components = place.address_components ?? [];

  const raw: Record<string, string> = {};
  for (const component of components) {
    for (const type of component.types) {
      raw[type] = component.long_name;
    }
  }

  return addressComponentsSchema.parse({
    houseNumber: raw.street_number ?? "",
    street: raw.route ?? "",
    town: raw.postal_town ?? raw.locality ?? "",
    postcode: raw.postal_code ?? "",
  });
}

export function AddressLookupInner({
  onChange,
  defaultAddress,
  defaultPostcode,
}: AddressLookupInnerProps = {}) {
  const places = useMapsLibrary("places");
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const hasDefaults = !!(defaultAddress ?? defaultPostcode);

  const [houseNumber, setHouseNumber] = useState(defaultAddress ?? "");
  const [street, setStreet] = useState("");
  const [town, setTown] = useState("");
  const [postcode, setPostcode] = useState(defaultPostcode ?? "");
  const [fieldsRevealed, setFieldsRevealed] = useState(hasDefaults);
  const [manualEntry, setManualEntry] = useState(false);

  // Initialise the Autocomplete widget once the Places library loads
  useEffect(() => {
    if (!places || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "gb" },
      types: ["address"],
      fields: ["address_components"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.address_components) return;

      const fields = extractAddressFields(place);
      setHouseNumber(fields.houseNumber);
      setStreet(fields.street);
      setTown(fields.town);
      setPostcode(fields.postcode);
      setFieldsRevealed(true);
    });

    autocompleteRef.current = autocomplete;
  }, [places]);

  const handleManualEntry = useCallback(() => {
    setManualEntry(true);
    setFieldsRevealed(true);
  }, []);

  // Combine address parts for the hidden form field
  const combinedAddress = [houseNumber, street, town]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");

  // Notify parent of changes in controlled mode
  useEffect(() => {
    onChange?.({ address: combinedAddress, postcode: postcode.trim() });
  }, [combinedAddress, postcode, onChange]);

  const showFields = fieldsRevealed || manualEntry;

  return (
    <div className="space-y-1">
      {/* Hidden inputs for form submission (only in uncontrolled mode) */}
      {!onChange && (
        <>
          <input type="hidden" name="address" value={combinedAddress} />
          <input type="hidden" name="postcode" value={postcode.trim()} />
        </>
      )}

      {/* Search input with Google Places Autocomplete */}
      <div className="group relative z-0 mt-2 mb-5 w-full">
        <input
          ref={inputRef}
          id="address-search"
          type="text"
          autoComplete="off"
          className={inputClass}
          placeholder=" "
        />
        <label htmlFor="address-search" className={labelClass}>
          Start typing your address...
        </label>
      </div>

      {/* Enter address manually link */}
      {!showFields && (
        <button
          type="button"
          onClick={handleManualEntry}
          className="mb-4 text-sm text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Enter address manually
        </button>
      )}

      {/* Address fields - revealed after place selection or manual entry */}
      {showFields && (
        <div className="space-y-1">
          {/* House Number / Name */}
          <div className="group relative z-0 mt-2 mb-5 w-full">
            <input
              id="house-number"
              type="text"
              required
              autoComplete="address-line1"
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value)}
              className={inputClass}
              placeholder=" "
            />
            <label htmlFor="house-number" className={labelClass}>
              House Number / Name
            </label>
          </div>

          {/* Street Address */}
          <div className="group relative z-0 mt-2 mb-5 w-full">
            <input
              id="street-address"
              type="text"
              required
              autoComplete="address-line2"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className={inputClass}
              placeholder=" "
            />
            <label htmlFor="street-address" className={labelClass}>
              Street Address
            </label>
          </div>

          {/* Town / City */}
          <div className="group relative z-0 mt-2 mb-5 w-full">
            <input
              id="town-city"
              type="text"
              required
              autoComplete="address-level2"
              value={town}
              onChange={(e) => setTown(e.target.value)}
              className={inputClass}
              placeholder=" "
            />
            <label htmlFor="town-city" className={labelClass}>
              Town / City
            </label>
          </div>

          {/* Postcode */}
          <div className="group relative z-0 mt-2 mb-5 w-full">
            <input
              id="postcode-input"
              type="text"
              required
              autoComplete="postal-code"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              className={inputClass}
              placeholder=" "
            />
            <label htmlFor="postcode-input" className={labelClass}>
              Postcode
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

export function AddressLookup() {
  return (
    <APIProvider apiKey={MAPS_API_KEY}>
      <AddressLookupInner />
    </APIProvider>
  );
}
