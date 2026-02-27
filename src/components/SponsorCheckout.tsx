import { Alert, AlertDescription } from "@/ui/Alert";
import { Button } from "@/ui/Button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/ui/Card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { actions } from "astro:actions";
import { formatPrice } from "@/lib/formatPrice";
import { type ChangeEvent, type FC, useCallback, useState } from "react";
import { PaymentForm } from "./PaymentForm";

type Props = {
  gameId: string;
  gameTitle: string;
};

type State =
  | { step: "details" }
  | {
      step: "paying";
      clientSecret: string;
      amount: number;
      productName: string;
    }
  | { step: "success" };

const MAX_MESSAGE_LENGTH = 100;
const MAX_LOGO_SIZE_BYTES = 150_000;

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
            new Error("Image is too large even after compression. Please use a smaller image."),
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

const SponsorCheckoutInner: FC<Props> = ({ gameId, gameTitle }) => {
  const [state, setState] = useState<State>({ step: "details" });
  const [sponsorName, setSponsorName] = useState("");
  const [sponsorEmail, setSponsorEmail] = useState("");
  const [sponsorWebsite, setSponsorWebsite] = useState("");
  const [sponsorMessage, setSponsorMessage] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>();
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string | null>(null);

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

  const createPaymentMutation = useMutation({
    mutationFn: () =>
      actions.sponsorship.createPayment({
        gameId,
        sponsorName,
        sponsorEmail,
        sponsorWebsite: sponsorWebsite || undefined,
        sponsorLogoDataUrl: logoDataUrl,
        sponsorMessage: sponsorMessage || undefined,
      }),
    onSuccess: (result) => {
      if (result.data) {
        setState({
          step: "paying",
          clientSecret: result.data.clientSecret,
          amount: result.data.amount,
          productName: result.data.productName,
        });
      }
    },
  });

  const priceQuery = useQuery({
    queryKey: ["sponsorship-price"],
    queryFn: async () => {
      const result = await actions.sponsorship.getPrice();
      if (result.error) throw result.error;
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const isFormValid =
    sponsorName.trim().length > 0 &&
    sponsorEmail.trim().length > 0 &&
    sponsorMessage.length <= MAX_MESSAGE_LENGTH &&
    !logoError;

  if (state.step === "success") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Thank You!</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p>
            Thank you for sponsoring this game! Your sponsorship details will be
            reviewed by our team and displayed on the game page once approved.
          </p>
          <p className="text-sm text-gray-600">
            A confirmation email has been sent to {sponsorEmail}.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (state.step === "paying") {
    return (
      <PaymentForm
        clientSecret={state.clientSecret}
        amount={state.amount}
        title={state.productName}
        onSuccess={() => setState({ step: "success" })}
        onCancel={() => setState({ step: "details" })}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sponsor This Game</CardTitle>
        <p className="text-sm text-gray-600">{gameTitle}</p>
        <p className="text-sm text-gray-600">
          Sponsor this game and your details will be displayed on the match
          page.{" "}
          <a
            href="/cricket/become-a-sponsor/"
            className="text-blue-600 underline hover:text-blue-800"
          >
            Learn about all the benefits of sponsoring
          </a>
          .
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {priceQuery.isPending && (
          <p className="text-sm text-gray-500">Loading price...</p>
        )}
        {priceQuery.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              Could not load pricing. Please refresh and try again.
            </AlertDescription>
          </Alert>
        )}
        {priceQuery.data && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <strong>Price:</strong> {formatPrice(priceQuery.data.amountPence)}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sponsorName">Your Name / Company Name *</Label>
          <Input
            id="sponsorName"
            value={sponsorName}
            onChange={(e) => setSponsorName(e.target.value)}
            placeholder="e.g. Smith & Sons Builders"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sponsorEmail">Contact Email *</Label>
          <Input
            id="sponsorEmail"
            type="email"
            value={sponsorEmail}
            onChange={(e) => setSponsorEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sponsorWebsite">Website URL</Label>
          <Input
            id="sponsorWebsite"
            type="url"
            value={sponsorWebsite}
            onChange={(e) => setSponsorWebsite(e.target.value)}
            placeholder="https://www.example.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sponsorLogo">Logo (optional)</Label>
          <Input
            id="sponsorLogo"
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sponsorMessage">
            Message / Dedication (optional, max {MAX_MESSAGE_LENGTH} chars)
          </Label>
          <Input
            id="sponsorMessage"
            value={sponsorMessage}
            onChange={(e) => setSponsorMessage(e.target.value)}
            placeholder='e.g. "Good luck lads!" or "In memory of..."'
            maxLength={MAX_MESSAGE_LENGTH}
          />
          <p className="text-xs text-gray-500">
            {sponsorMessage.length}/{MAX_MESSAGE_LENGTH}
          </p>
        </div>

        {createPaymentMutation.error && (
          <Alert variant="destructive">
            <AlertDescription>
              Something went wrong. Please try again.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={() => createPaymentMutation.mutate()}
          disabled={createPaymentMutation.isPending || !isFormValid}
        >
          {createPaymentMutation.isPending
            ? "Processing..."
            : "Continue to Payment"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export const SponsorCheckout: FC<Props> = (props) => {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <SponsorCheckoutInner {...props} />
    </QueryClientProvider>
  );
};
