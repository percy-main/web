import { useCallback, useEffect, useRef, useState } from "react";

type PostcodeResult = {
  admin_district: string | null;
  admin_county: string | null;
  region: string | null;
};

type AutocompleteResponse = {
  status: number;
  result: string[] | null;
};

type LookupResponse = {
  status: number;
  result: PostcodeResult | null;
};

type Status = "idle" | "loading" | "valid" | "invalid";

export const PostcodeLookup: React.FC = () => {
  const [postcode, setPostcode] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [areaInfo, setAreaInfo] = useState("");
  const [address, setAddress] = useState("");
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (partial: string) => {
    if (partial.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const res = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(partial)}/autocomplete`,
      );
      const data = (await res.json()) as AutocompleteResponse;
      if (data.status === 200 && Array.isArray(data.result)) {
        setSuggestions(data.result);
        setShowSuggestions(data.result.length > 0);
        setActiveSuggestion(-1);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  const validatePostcode = useCallback(async (pc: string) => {
    setStatus("loading");
    setAreaInfo("");
    try {
      const res = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`,
      );
      const data = (await res.json()) as LookupResponse;
      if (data.status === 200 && data.result) {
        const result = data.result;
        const parts = [result.admin_district, result.admin_county, result.region]
          .filter(Boolean);
        setAreaInfo(parts.join(", "));
        setStatus("valid");
      } else {
        setStatus("invalid");
      }
    } catch {
      setStatus("invalid");
    }
  }, []);

  const handlePostcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setPostcode(value);
    setStatus("idle");
    setAreaInfo("");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(value.trim());
    }, 300);
  };

  const selectPostcode = (pc: string) => {
    setPostcode(pc);
    setSuggestions([]);
    setShowSuggestions(false);
    void validatePostcode(pc);
  };

  const handlePostcodeBlur = () => {
    // Delay to allow click on suggestion
    setTimeout(() => {
      setShowSuggestions(false);
      const trimmed = postcode.trim();
      if (trimmed.length >= 5 && status === "idle") {
        void validatePostcode(trimmed);
      }
    }, 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestion((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestion((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1,
      );
    } else if (e.key === "Enter" && activeSuggestion >= 0) {
      e.preventDefault();
      selectPostcode(suggestions[activeSuggestion]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="space-y-1">
      {/* Postcode field */}
      <div ref={wrapperRef} className="relative">
        <div className="group relative z-0 mt-2 mb-5 w-full">
          <div className="relative">
            <input
              id="postcode"
              name="postcode"
              type="text"
              required
              autoComplete="postal-code"
              value={postcode}
              onChange={handlePostcodeChange}
              onBlur={handlePostcodeBlur}
              onKeyDown={handleKeyDown}
              aria-autocomplete="list"
              aria-expanded={showSuggestions}
              aria-controls="postcode-suggestions"
              aria-describedby={areaInfo ? "postcode-area" : undefined}
              className="peer block w-full appearance-none border-0 border-b-2 border-gray-300 bg-transparent pr-8 text-sm text-gray-900 focus:border-blue-600 focus:ring-0 focus:outline-none dark:border-gray-600 dark:text-white dark:focus:border-blue-500"
              placeholder=" "
            />
            <label
              htmlFor="postcode"
              className="absolute top-3 origin-[0] -translate-y-7 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:start-0 peer-focus:-translate-y-7 peer-focus:scale-75 peer-focus:font-medium peer-focus:text-blue-600 rtl:peer-focus:left-auto rtl:peer-focus:translate-x-1/4 dark:text-gray-400 peer-focus:dark:text-blue-500"
            >
              Postcode
            </label>
            {/* Status indicator */}
            <span className="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2">
              {status === "loading" && (
                <svg
                  className="h-5 w-5 animate-spin text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              )}
              {status === "valid" && (
                <svg
                  className="h-5 w-5 text-green-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-label="Valid postcode"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              )}
              {status === "invalid" && (
                <svg
                  className="h-5 w-5 text-red-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-label="Invalid postcode"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </span>
          </div>
        </div>

        {/* Autocomplete suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <ul
            id="postcode-suggestions"
            role="listbox"
            className="absolute z-50 mt-[-16px] max-h-48 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg"
          >
            {suggestions.map((s, i) => (
              <li
                key={s}
                role="option"
                aria-selected={i === activeSuggestion}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  i === activeSuggestion
                    ? "bg-blue-600 text-white"
                    : "text-gray-900 hover:bg-blue-50"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectPostcode(s);
                }}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Area info */}
      {status === "valid" && areaInfo && (
        <p id="postcode-area" className="mt-[-12px] mb-4 text-sm text-green-600">
          {areaInfo}
        </p>
      )}
      {status === "invalid" && (
        <p className="mt-[-12px] mb-4 text-sm text-red-600">
          Postcode not recognised. Please check and try again.
        </p>
      )}

      {/* Address field */}
      <div className="group relative z-0 mb-5 w-full">
        <textarea
          id="address"
          name="address"
          required
          rows={4}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder=" "
          className="peer block w-full appearance-none border-0 border-b-2 border-gray-300 bg-transparent text-sm text-gray-900 focus:border-blue-600 focus:ring-0 focus:outline-hidden dark:border-gray-600 dark:text-white dark:focus:border-blue-500"
        />
        <label
          htmlFor="address"
          className="absolute top-3 origin-[0] -translate-y-7 scale-75 transform text-sm text-gray-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:start-0 peer-focus:-translate-y-7 peer-focus:scale-75 peer-focus:font-medium peer-focus:text-blue-600 peer-focus:rtl:left-auto peer-focus:rtl:translate-x-1/4 dark:text-gray-400 dark:peer-focus:text-blue-500"
        >
          Address
        </label>
      </div>
    </div>
  );
};
