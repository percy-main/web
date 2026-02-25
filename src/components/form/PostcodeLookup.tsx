import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";

const inputClass =
  "peer block w-full appearance-none border-0 border-b-2 border-gray-300 bg-transparent text-sm text-gray-900 focus:border-blue-600 focus:ring-0 focus:outline-none dark:border-gray-600 dark:text-white dark:focus:border-blue-500";

const labelClass =
  "absolute top-3 origin-[0] -translate-y-7 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:start-0 peer-focus:-translate-y-7 peer-focus:scale-75 peer-focus:font-medium peer-focus:text-blue-600 rtl:peer-focus:left-auto rtl:peer-focus:translate-x-1/4 dark:text-gray-400 peer-focus:dark:text-blue-500";

// --- Zod schemas for postcodes.io API responses ---

const autocompleteResponseSchema = z.object({
  status: z.number(),
  result: z.array(z.string()).nullable(),
});

const lookupResponseSchema = z.object({
  status: z.number(),
  result: z
    .object({
      admin_district: z.string().nullable(),
      admin_county: z.string().nullable(),
      region: z.string().nullable(),
    })
    .nullable(),
});

// --- Inner component (must be inside QueryClientProvider) ---

function PostcodeLookupInner() {
  const [houseNumber, setHouseNumber] = useState("");
  const [postcodeInput, setPostcodeInput] = useState("");
  const [street, setStreet] = useState("");
  const [town, setTown] = useState("");

  const [debouncedPostcode, setDebouncedPostcode] = useState("");
  const [selectedPostcode, setSelectedPostcode] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [fieldsRevealed, setFieldsRevealed] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);

  // Debounce the postcode input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPostcode(postcodeInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [postcodeInput]);

  // Autocomplete query
  const { data: autocompleteData } = useQuery({
    queryKey: ["postcode-autocomplete", debouncedPostcode],
    queryFn: async () => {
      const res = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(debouncedPostcode)}/autocomplete`,
      );
      return autocompleteResponseSchema.parse(await res.json());
    },
    enabled: debouncedPostcode.length >= 2 && !selectedPostcode,
  });

  // Lookup query (triggered when a postcode is selected)
  const { data: lookupData } = useQuery({
    queryKey: ["postcode-lookup", selectedPostcode],
    queryFn: async () => {
      const res = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(selectedPostcode!)}`,
      );
      return lookupResponseSchema.parse(await res.json());
    },
    enabled: !!selectedPostcode,
  });

  // When lookup completes, populate town and reveal fields
  useEffect(() => {
    if (!lookupData?.result) return;
    const { admin_district, admin_county } = lookupData.result;
    setTown(admin_district ?? admin_county ?? "");
    setFieldsRevealed(true);
  }, [lookupData]);

  const suggestions = autocompleteData?.result ?? [];

  const handleSelectPostcode = (postcode: string) => {
    setPostcodeInput(postcode);
    setSelectedPostcode(postcode);
    setShowSuggestions(false);
  };

  const handleManualEntry = () => {
    setManualEntry(true);
    setFieldsRevealed(true);
    setShowSuggestions(false);
  };

  // Combine address for the hidden form field
  const combinedAddress = [houseNumber, street]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");

  const showDetailFields = fieldsRevealed || manualEntry;

  return (
    <div className="space-y-1">
      {/* Hidden inputs for form submission */}
      <input type="hidden" name="address" value={combinedAddress} />
      <input type="hidden" name="postcode" value={postcodeInput.trim()} />

      {/* House Number / Name -- always visible */}
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

      {/* Postcode with autocomplete -- always visible */}
      <div className="group relative z-0 mt-2 mb-5 w-full">
        <input
          id="postcode-input"
          type="text"
          required
          autoComplete="postal-code"
          value={postcodeInput}
          onChange={(e) => {
            const value = e.target.value.toUpperCase();
            setPostcodeInput(value);
            setSelectedPostcode(null);
            setShowSuggestions(true);
          }}
          onFocus={() => {
            if (!selectedPostcode && postcodeInput.length >= 2) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            // Delay to allow click on suggestion
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          className={inputClass}
          placeholder=" "
        />
        <label htmlFor="postcode-input" className={labelClass}>
          Postcode
        </label>

        {/* Autocomplete suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
            {suggestions.map((postcode) => (
              <li key={postcode}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-blue-50 dark:text-white dark:hover:bg-gray-700"
                  onMouseDown={(e) => {
                    // Prevent blur from firing before click
                    e.preventDefault();
                  }}
                  onClick={() => handleSelectPostcode(postcode)}
                >
                  {postcode}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Enter address manually link */}
      {!showDetailFields && (
        <button
          type="button"
          onClick={handleManualEntry}
          className="mb-4 text-sm text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Enter address manually
        </button>
      )}

      {/* Street and Town fields -- revealed after postcode selection or manual entry */}
      {showDetailFields && (
        <div className="space-y-1">
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
        </div>
      )}
    </div>
  );
}

// --- Exported wrapper with its own QueryClientProvider ---

const queryClient = new QueryClient();

export function PostcodeLookup() {
  return (
    <QueryClientProvider client={queryClient}>
      <PostcodeLookupInner />
    </QueryClientProvider>
  );
}
