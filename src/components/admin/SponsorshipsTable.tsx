import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/Table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { formatDate } from "date-fns";
import {
  type ChangeEvent,
  type FC,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const PAGE_SIZE = 20;

type Filter = "all" | "pending_payment" | "pending_approval" | "approved";

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type Sponsorship = {
  id: string | null;
  gameId: string;
  sponsorName: string;
  sponsorEmail: string;
  sponsorWebsite: string | null;
  sponsorLogoUrl: string | null;
  sponsorMessage: string | null;
  approved: boolean;
  displayName: string | null;
  amountPence: number;
  paidAt: string | null;
  createdAt: string;
  notes: string | null;
};

type GameOption = {
  id: string;
  date: string;
  team: string;
  opposition: string;
  home: boolean;
};

const MAX_MESSAGE_LENGTH = 100;
const MAX_LOGO_SIZE_BYTES = 100_000;

function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        const maxDim = 300;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.8;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);

        while (dataUrl.length > maxSize && quality > 0.1) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }

        if (dataUrl.length > maxSize) {
          reject(
            new Error(
              "Image is too large even after compression. Please use a smaller image.",
            ),
          );
          return;
        }

        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// --- Game Selector (typeahead) ---

const GameSelector: FC<{
  selectedGame: GameOption | null;
  onSelect: (game: GameOption | null) => void;
}> = ({ selectedGame, onSelect }) => {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const { data, isFetching } = useQuery({
    queryKey: ["admin", "listGames", debouncedSearch],
    queryFn: () =>
      actions.sponsorship.listGames({
        search: debouncedSearch || undefined,
      }),
    enabled: isOpen,
  });

  const games = data?.data?.games ?? [];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (selectedGame) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">
          {selectedGame.date} — {selectedGame.team} vs {selectedGame.opposition}
        </span>
        <Button
          type="button"
          variant="outline"
          className="h-6 px-2 text-xs"
          onClick={() => {
            onSelect(null);
            setSearch("");
          }}
        >
          Change
        </Button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        type="text"
        placeholder="Search by opponent name..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
      />
      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {isFetching && (
            <div className="px-3 py-2 text-sm text-gray-500">Searching...</div>
          )}
          {!isFetching && games.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">
              No games found.
            </div>
          )}
          {games.map((game) => (
            <button
              key={game.id}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
              onClick={() => {
                onSelect(game);
                setIsOpen(false);
              }}
            >
              {game.date} — {game.team} vs {game.opposition}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Create Sponsorship Modal ---

const CreateSponsorshipModal: FC<{ onClose: () => void }> = ({ onClose }) => {
  const queryClient = useQueryClient();

  const [selectedGame, setSelectedGame] = useState<GameOption | null>(null);
  const [sponsorName, setSponsorName] = useState("");
  const [sponsorEmail, setSponsorEmail] = useState("");
  const [sponsorWebsite, setSponsorWebsite] = useState("");
  const [sponsorMessage, setSponsorMessage] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>();
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string | null>(null);
  const [amountGBP, setAmountGBP] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [notes, setNotes] = useState("");

  const handleLogoChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      setLogoError(null);
      const file = e.target.files?.[0];
      if (!file) {
        setLogoDataUrl(undefined);
        setLogoFileName(null);
        return;
      }

      if (!file.type.startsWith("image/")) {
        setLogoError("Please select an image file");
        return;
      }

      try {
        const dataUrl = await resizeImage(file, MAX_LOGO_SIZE_BYTES);
        setLogoDataUrl(dataUrl);
        setLogoFileName(file.name);
      } catch (err) {
        setLogoError(
          err instanceof Error ? err.message : "Failed to process image",
        );
      }
    },
    [],
  );

  const createMutation = useMutation({
    mutationFn: () => {
      if (!selectedGame) {
        return Promise.reject(new Error("No game selected"));
      }
      const parsedAmount = parseFloat(amountGBP);
      const amountPence = Math.round(parsedAmount * 100);

      return actions.sponsorship.createManual({
        gameId: selectedGame.id,
        sponsorName,
        sponsorEmail,
        sponsorWebsite: sponsorWebsite || undefined,
        sponsorLogoDataUrl: logoDataUrl,
        sponsorMessage: sponsorMessage || undefined,
        amountPence,
        displayName: displayName || undefined,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin", "sponsorships"],
      });
      onClose();
    },
  });

  const parsedAmount = parseFloat(amountGBP);
  const isAmountValid = amountGBP !== "" && !isNaN(parsedAmount) && parsedAmount >= 0;
  const isFormValid =
    selectedGame !== null &&
    sponsorName.trim().length > 0 &&
    sponsorEmail.trim().length > 0 &&
    isAmountValid &&
    sponsorMessage.length <= MAX_MESSAGE_LENGTH &&
    !logoError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">Create Manual Sponsorship</h2>

        <div className="flex flex-col gap-4">
          {/* Game selector */}
          <div className="flex flex-col gap-1.5">
            <Label>Game *</Label>
            <GameSelector
              selectedGame={selectedGame}
              onSelect={setSelectedGame}
            />
          </div>

          {/* Sponsor name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manual-sponsorName">Sponsor Name *</Label>
            <Input
              id="manual-sponsorName"
              value={sponsorName}
              onChange={(e) => setSponsorName(e.target.value)}
              placeholder="e.g. Smith & Sons Builders"
              required
            />
          </div>

          {/* Sponsor email */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manual-sponsorEmail">Sponsor Email *</Label>
            <Input
              id="manual-sponsorEmail"
              type="email"
              value={sponsorEmail}
              onChange={(e) => setSponsorEmail(e.target.value)}
              placeholder="sponsor@example.com"
              required
            />
          </div>

          {/* Sponsor website */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manual-sponsorWebsite">Website URL</Label>
            <Input
              id="manual-sponsorWebsite"
              type="url"
              value={sponsorWebsite}
              onChange={(e) => setSponsorWebsite(e.target.value)}
              placeholder="https://www.example.com"
            />
          </div>

          {/* Logo upload */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manual-sponsorLogo">Logo (optional)</Label>
            <Input
              id="manual-sponsorLogo"
              type="file"
              accept="image/*"
              onChange={(e) => void handleLogoChange(e)}
            />
            {logoError && (
              <p className="text-sm text-red-600">{logoError}</p>
            )}
            {logoFileName && !logoError && (
              <p className="text-sm text-gray-600">Selected: {logoFileName}</p>
            )}
            {logoDataUrl && (
              <div className="mt-1">
                <img
                  src={logoDataUrl}
                  alt="Logo preview"
                  className="h-16 max-w-full rounded border object-contain"
                />
              </div>
            )}
          </div>

          {/* Sponsor message */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manual-sponsorMessage">
              Message (optional, max {MAX_MESSAGE_LENGTH} chars)
            </Label>
            <Input
              id="manual-sponsorMessage"
              value={sponsorMessage}
              onChange={(e) => setSponsorMessage(e.target.value)}
              placeholder='e.g. "Good luck lads!"'
              maxLength={MAX_MESSAGE_LENGTH}
            />
            <p className="text-xs text-gray-500">
              {sponsorMessage.length}/{MAX_MESSAGE_LENGTH}
            </p>
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manual-amount">Amount (GBP) *</Label>
            <Input
              id="manual-amount"
              type="number"
              min="0"
              step="0.01"
              value={amountGBP}
              onChange={(e) => setAmountGBP(e.target.value)}
              placeholder="0.00"
              required
            />
            <p className="text-xs text-gray-500">
              Enter 0 for complimentary sponsorships.
            </p>
          </div>

          {/* Display name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manual-displayName">Display Name (optional)</Label>
            <Input
              id="manual-displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Override display name"
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manual-notes">Notes (optional)</Label>
            <Input
              id="manual-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes"
            />
          </div>

          {/* Error display */}
          {createMutation.error && (
            <p className="text-sm text-red-600">
              Failed to create sponsorship. Please try again.
            </p>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={!isFormValid || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create Sponsorship"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Sponsorship Row ---

const SponsorshipRow: FC<{ sponsorship: Sponsorship }> = ({ sponsorship }) => {
  const queryClient = useQueryClient();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(sponsorship.notes ?? "");
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayName, setDisplayName] = useState(
    sponsorship.displayName ?? "",
  );
  const [editingLogo, setEditingLogo] = useState(false);
  const [newLogoDataUrl, setNewLogoDataUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const sponsorshipId = sponsorship.id ?? "";

  const approveMutation = useMutation({
    mutationFn: () =>
      actions.sponsorship.approve({
        sponsorshipId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "sponsorships"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      actions.sponsorship.reject({
        sponsorshipId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "sponsorships"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      displayName?: string;
      notes?: string;
      sponsorLogoDataUrl?: string | null;
    }) =>
      actions.sponsorship.update({
        sponsorshipId,
        ...data,
      }),
    onSuccess: () => {
      setEditingNotes(false);
      setEditingDisplayName(false);
      setEditingLogo(false);
      setNewLogoDataUrl(null);
      setLogoError(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "sponsorships"] });
    },
  });

  const handleLogoFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      setLogoError(null);
      const file = e.target.files?.[0];
      if (!file) {
        setNewLogoDataUrl(null);
        return;
      }
      if (!file.type.startsWith("image/")) {
        setLogoError("Please select an image file");
        return;
      }
      try {
        const dataUrl = await resizeImage(file, MAX_LOGO_SIZE_BYTES);
        setNewLogoDataUrl(dataUrl);
      } catch (err) {
        setLogoError(
          err instanceof Error ? err.message : "Failed to process image",
        );
      }
    },
    [],
  );

  const getStatusBadge = () => {
    if (!sponsorship.paidAt) {
      return <Badge variant="warning">Pending Payment</Badge>;
    }
    if (!sponsorship.approved) {
      return <Badge variant="info">Pending Approval</Badge>;
    }
    return <Badge variant="success">Approved</Badge>;
  };

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="font-medium">{sponsorship.gameId}</span>
          <a
            href={`/calendar/event/${sponsorship.gameId}`}
            className="text-xs text-blue-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            View game
          </a>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="font-medium">{sponsorship.sponsorName}</span>
          <span className="text-xs text-gray-500">
            {sponsorship.sponsorEmail}
          </span>
          {sponsorship.sponsorWebsite && (
            <a
              href={sponsorship.sponsorWebsite}
              className="text-xs text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {sponsorship.sponsorWebsite}
            </a>
          )}
          {editingLogo ? (
            <div className="mt-1 flex flex-col gap-1">
              {newLogoDataUrl ? (
                <img
                  src={newLogoDataUrl}
                  alt="Logo preview"
                  className="h-8 max-w-[80px] object-contain"
                />
              ) : sponsorship.sponsorLogoUrl ? (
                <img
                  src={sponsorship.sponsorLogoUrl}
                  alt="Logo preview"
                  className="h-8 max-w-[80px] object-contain"
                />
              ) : null}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => void handleLogoFileChange(e)}
                className="w-40 text-xs"
              />
              {logoError && (
                <p className="text-xs text-red-600">{logoError}</p>
              )}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  onClick={() =>
                    updateMutation.mutate({
                      sponsorLogoDataUrl: newLogoDataUrl,
                    })
                  }
                  disabled={!newLogoDataUrl || updateMutation.isPending}
                >
                  Save
                </Button>
                {sponsorship.sponsorLogoUrl && (
                  <Button
                    variant="outline"
                    className="h-6 px-2 text-xs text-red-600"
                    onClick={() =>
                      updateMutation.mutate({ sponsorLogoDataUrl: null })
                    }
                    disabled={updateMutation.isPending}
                  >
                    Remove
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    setEditingLogo(false);
                    setNewLogoDataUrl(null);
                    setLogoError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              {sponsorship.sponsorLogoUrl && (
                <img
                  src={sponsorship.sponsorLogoUrl}
                  alt="Sponsor logo"
                  className="mt-1 h-8 max-w-[80px] object-contain"
                />
              )}
              <button
                onClick={() => setEditingLogo(true)}
                className="text-left text-xs text-blue-600 hover:underline"
              >
                {sponsorship.sponsorLogoUrl ? "Change logo" : "Add logo"}
              </button>
            </>
          )}
        </div>
      </TableCell>
      <TableCell>
        {sponsorship.sponsorMessage && (
          <span className="text-sm italic">
            &ldquo;{sponsorship.sponsorMessage}&rdquo;
          </span>
        )}
      </TableCell>
      <TableCell>{currencyFormatter.format(sponsorship.amountPence / 100)}</TableCell>
      <TableCell>{getStatusBadge()}</TableCell>
      <TableCell>
        {sponsorship.paidAt
          ? formatDate(sponsorship.paidAt, "dd/MM/yyyy")
          : "-"}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          {editingDisplayName ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-32 rounded border px-1 py-0.5 text-xs"
                placeholder="Display name"
              />
              <Button
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={() =>
                  updateMutation.mutate({ displayName })
                }
                disabled={updateMutation.isPending}
              >
                Save
              </Button>
              <Button
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={() => setEditingDisplayName(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setEditingDisplayName(true)}
              className="text-left text-xs text-blue-600 hover:underline"
            >
              {sponsorship.displayName ?? "Set display name"}
            </button>
          )}
          {editingNotes ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-32 rounded border px-1 py-0.5 text-xs"
                placeholder="Notes"
              />
              <Button
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={() => updateMutation.mutate({ notes })}
                disabled={updateMutation.isPending}
              >
                Save
              </Button>
              <Button
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={() => setEditingNotes(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setEditingNotes(true)}
              className="text-left text-xs text-blue-600 hover:underline"
            >
              {sponsorship.notes ?? "Add notes"}
            </button>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          {sponsorship.paidAt && !sponsorship.approved && (
            <Button
              variant="default"
              className="h-7 px-3 text-xs"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? "..." : "Approve"}
            </Button>
          )}
          {sponsorship.approved && (
            <Button
              variant="outline"
              className="h-7 px-3 text-xs"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "..." : "Revoke"}
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

// --- Player Sponsorship Row ---

type PlayerSponsorship = {
  id: string | null;
  contentfulEntryId: string;
  playerName: string;
  season: number;
  sponsorName: string;
  sponsorEmail: string;
  sponsorWebsite: string | null;
  sponsorLogoUrl: string | null;
  sponsorMessage: string | null;
  approved: boolean;
  displayName: string | null;
  amountPence: number;
  paidAt: string | null;
  createdAt: string;
  notes: string | null;
};

const PlayerSponsorshipRow: FC<{ sponsorship: PlayerSponsorship }> = ({
  sponsorship,
}) => {
  const queryClient = useQueryClient();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(sponsorship.notes ?? "");
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayName, setDisplayName] = useState(
    sponsorship.displayName ?? "",
  );
  const [editingLogo, setEditingLogo] = useState(false);
  const [newLogoDataUrl, setNewLogoDataUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const sponsorshipId = sponsorship.id ?? "";

  const approveMutation = useMutation({
    mutationFn: () =>
      actions.playerSponsorship.approve({ sponsorshipId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin", "playerSponsorships"],
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      actions.playerSponsorship.reject({ sponsorshipId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin", "playerSponsorships"],
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      displayName?: string;
      notes?: string;
      sponsorLogoDataUrl?: string | null;
    }) =>
      actions.playerSponsorship.update({ sponsorshipId, ...data }),
    onSuccess: () => {
      setEditingNotes(false);
      setEditingDisplayName(false);
      setEditingLogo(false);
      setNewLogoDataUrl(null);
      setLogoError(null);
      void queryClient.invalidateQueries({
        queryKey: ["admin", "playerSponsorships"],
      });
    },
  });

  const handleLogoFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      setLogoError(null);
      const file = e.target.files?.[0];
      if (!file) {
        setNewLogoDataUrl(null);
        return;
      }
      if (!file.type.startsWith("image/")) {
        setLogoError("Please select an image file");
        return;
      }
      try {
        const dataUrl = await resizeImage(file, MAX_LOGO_SIZE_BYTES);
        setNewLogoDataUrl(dataUrl);
      } catch (err) {
        setLogoError(
          err instanceof Error ? err.message : "Failed to process image",
        );
      }
    },
    [],
  );

  const getStatusBadge = () => {
    if (!sponsorship.paidAt) {
      return <Badge variant="warning">Pending Payment</Badge>;
    }
    if (!sponsorship.approved) {
      return <Badge variant="info">Pending Approval</Badge>;
    }
    return <Badge variant="success">Approved</Badge>;
  };

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="font-medium">{sponsorship.playerName}</span>
          <span className="text-xs text-gray-500">
            Season {sponsorship.season}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="font-medium">{sponsorship.sponsorName}</span>
          <span className="text-xs text-gray-500">
            {sponsorship.sponsorEmail}
          </span>
          {sponsorship.sponsorWebsite && (
            <a
              href={sponsorship.sponsorWebsite}
              className="text-xs text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {sponsorship.sponsorWebsite}
            </a>
          )}
          {editingLogo ? (
            <div className="mt-1 flex flex-col gap-1">
              {newLogoDataUrl ? (
                <img
                  src={newLogoDataUrl}
                  alt="Logo preview"
                  className="h-8 max-w-[80px] object-contain"
                />
              ) : sponsorship.sponsorLogoUrl ? (
                <img
                  src={sponsorship.sponsorLogoUrl}
                  alt="Logo preview"
                  className="h-8 max-w-[80px] object-contain"
                />
              ) : null}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => void handleLogoFileChange(e)}
                className="w-40 text-xs"
              />
              {logoError && (
                <p className="text-xs text-red-600">{logoError}</p>
              )}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  onClick={() =>
                    updateMutation.mutate({
                      sponsorLogoDataUrl: newLogoDataUrl,
                    })
                  }
                  disabled={!newLogoDataUrl || updateMutation.isPending}
                >
                  Save
                </Button>
                {sponsorship.sponsorLogoUrl && (
                  <Button
                    variant="outline"
                    className="h-6 px-2 text-xs text-red-600"
                    onClick={() =>
                      updateMutation.mutate({ sponsorLogoDataUrl: null })
                    }
                    disabled={updateMutation.isPending}
                  >
                    Remove
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    setEditingLogo(false);
                    setNewLogoDataUrl(null);
                    setLogoError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              {sponsorship.sponsorLogoUrl && (
                <img
                  src={sponsorship.sponsorLogoUrl}
                  alt="Sponsor logo"
                  className="mt-1 h-8 max-w-[80px] object-contain"
                />
              )}
              <button
                onClick={() => setEditingLogo(true)}
                className="text-left text-xs text-blue-600 hover:underline"
              >
                {sponsorship.sponsorLogoUrl ? "Change logo" : "Add logo"}
              </button>
            </>
          )}
        </div>
      </TableCell>
      <TableCell>
        {sponsorship.sponsorMessage && (
          <span className="text-sm italic">
            &ldquo;{sponsorship.sponsorMessage}&rdquo;
          </span>
        )}
      </TableCell>
      <TableCell>
        {currencyFormatter.format(sponsorship.amountPence / 100)}
      </TableCell>
      <TableCell>{getStatusBadge()}</TableCell>
      <TableCell>
        {sponsorship.paidAt
          ? formatDate(sponsorship.paidAt, "dd/MM/yyyy")
          : "-"}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          {editingDisplayName ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-32 rounded border px-1 py-0.5 text-xs"
                placeholder="Display name"
              />
              <Button
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={() => updateMutation.mutate({ displayName })}
                disabled={updateMutation.isPending}
              >
                Save
              </Button>
              <Button
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={() => setEditingDisplayName(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setEditingDisplayName(true)}
              className="text-left text-xs text-blue-600 hover:underline"
            >
              {sponsorship.displayName ?? "Set display name"}
            </button>
          )}
          {editingNotes ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-32 rounded border px-1 py-0.5 text-xs"
                placeholder="Notes"
              />
              <Button
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={() => updateMutation.mutate({ notes })}
                disabled={updateMutation.isPending}
              >
                Save
              </Button>
              <Button
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={() => setEditingNotes(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setEditingNotes(true)}
              className="text-left text-xs text-blue-600 hover:underline"
            >
              {sponsorship.notes ?? "Add notes"}
            </button>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          {sponsorship.paidAt && !sponsorship.approved && (
            <Button
              variant="default"
              className="h-7 px-3 text-xs"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? "..." : "Approve"}
            </Button>
          )}
          {sponsorship.approved && (
            <Button
              variant="outline"
              className="h-7 px-3 text-xs"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "..." : "Revoke"}
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

// --- Main Table ---

type SponsorshipTab = "game" | "player";

export function SponsorshipsTable() {
  const [tab, setTab] = useState<SponsorshipTab>("game");
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const gameQuery = useQuery({
    queryKey: ["admin", "sponsorships", page, PAGE_SIZE, filter],
    queryFn: () =>
      actions.sponsorship.list({
        page,
        pageSize: PAGE_SIZE,
        filter: filter === "all" ? undefined : filter,
      }),
    enabled: tab === "game",
  });

  const playerQuery = useQuery({
    queryKey: ["admin", "playerSponsorships", page, PAGE_SIZE, filter],
    queryFn: () =>
      actions.playerSponsorship.list({
        page,
        pageSize: PAGE_SIZE,
        filter: filter === "all" ? undefined : filter,
      }),
    enabled: tab === "player",
  });

  const result = tab === "game" ? gameQuery.data?.data : playerQuery.data?.data;
  const isLoading = tab === "game" ? gameQuery.isLoading : playerQuery.isLoading;
  const error = tab === "game" ? gameQuery.error : playerQuery.error;

  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / PAGE_SIZE))
    : 1;

  return (
    <div className="flex flex-col gap-4">
      {/* Tab pills */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setTab("game");
            setPage(1);
          }}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            tab === "game"
              ? "bg-green-700 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Game Sponsorships
        </button>
        <button
          onClick={() => {
            setTab("player");
            setPage(1);
          }}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            tab === "player"
              ? "bg-blue-700 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Player Sponsorships
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Filter:</label>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as Filter);
              setPage(1);
            }}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="all">All</option>
            <option value="pending_payment">Pending Payment</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
          </select>
        </div>
        {result && (
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>
              {result.total} sponsorship{result.total !== 1 ? "s" : ""}
            </span>
          </div>
        )}
        {tab === "game" && (
          <div className="ml-auto">
            <Button onClick={() => setShowCreateModal(true)}>
              Create Sponsorship
            </Button>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateSponsorshipModal onClose={() => setShowCreateModal(false)} />
      )}

      {isLoading && <p className="text-gray-500">Loading...</p>}
      {error && <p className="text-red-600">Failed to load sponsorships.</p>}

      {result && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tab === "game" ? "Game" : "Player"}</TableHead>
                <TableHead>Sponsor</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.sponsorships.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-6 text-center text-gray-500"
                  >
                    No sponsorships found.
                  </TableCell>
                </TableRow>
              )}
              {tab === "game" &&
                (result as { sponsorships: Sponsorship[] }).sponsorships.map(
                  (sponsorship) => (
                    <SponsorshipRow
                      key={sponsorship.id}
                      sponsorship={sponsorship}
                    />
                  ),
                )}
              {tab === "player" &&
                (
                  result as { sponsorships: PlayerSponsorship[] }
                ).sponsorships.map((sponsorship) => (
                  <PlayerSponsorshipRow
                    key={sponsorship.id}
                    sponsorship={sponsorship}
                  />
                ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {result.total} sponsorship{result.total !== 1 ? "s" : ""} total
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
