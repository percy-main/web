import { Button } from "@/components/ui/Button";
import { generateTeamImage } from "@/lib/fantasy/generate-team-image";
import { useMutation } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { useState } from "react";

export function ShareMyTeamButton() {
  const [shared, setShared] = useState(false);

  const shareMutation = useMutation({
    mutationFn: async () => {
      const result = await actions.fantasy.getTeamShareData({});
      if (result.error) throw result.error;
      const blob = await generateTeamImage(result.data);
      return blob;
    },
    onSuccess: async (blob: Blob) => {
      const file = new File([blob], "my-fantasy-team.png", {
        type: "image/png",
      });

      // Try Web Share API (mobile)
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "My Fantasy Cricket Team",
          });
          setShared(true);
          setTimeout(() => setShared(false), 2000);
          return;
        } catch {
          // User cancelled or share failed — fall through to download
        }
      }

      // Fallback: download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-fantasy-team.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => shareMutation.mutate()}
      disabled={shareMutation.isPending}
    >
      {shareMutation.isPending
        ? "Generating..."
        : shared
          ? "Done!"
          : "Share My Team"}
    </Button>
  );
}
