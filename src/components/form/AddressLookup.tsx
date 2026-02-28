import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MAPS_API_KEY } from "astro:env/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "astro:schema";

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
      <div className="mt-2 mb-5 w-full space-y-2">
        <Label htmlFor="address-search">Start typing your address...</Label>
        <Input
          ref={inputRef}
          id="address-search"
          type="text"
          autoComplete="off"
        />
      </div>

      {/* Enter address manually link */}
      {!showFields && (
        <Button
          type="button"
          variant="link"
          onClick={handleManualEntry}
          className="mb-4"
        >
          Enter address manually
        </Button>
      )}

      {/* Address fields - revealed after place selection or manual entry */}
      {showFields && (
        <div className="space-y-4">
          {/* House Number / Name */}
          <div className="w-full space-y-2">
            <Label htmlFor="house-number">House Number / Name</Label>
            <Input
              id="house-number"
              type="text"
              required
              autoComplete="address-line1"
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value)}
            />
          </div>

          {/* Street Address */}
          <div className="w-full space-y-2">
            <Label htmlFor="street-address">Street Address</Label>
            <Input
              id="street-address"
              type="text"
              required
              autoComplete="address-line2"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
            />
          </div>

          {/* Town / City */}
          <div className="w-full space-y-2">
            <Label htmlFor="town-city">Town / City</Label>
            <Input
              id="town-city"
              type="text"
              required
              autoComplete="address-level2"
              value={town}
              onChange={(e) => setTown(e.target.value)}
            />
          </div>

          {/* Postcode */}
          <div className="w-full space-y-2">
            <Label htmlFor="postcode-input">Postcode</Label>
            <Input
              id="postcode-input"
              type="text"
              required
              autoComplete="postal-code"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
            />
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
