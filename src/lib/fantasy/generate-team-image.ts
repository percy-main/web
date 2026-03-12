/**
 * Generates a 1080×1080 team sheet image using HTML5 Canvas.
 * Returns a Blob (PNG) ready for download or sharing.
 */

export interface SharePlayer {
  playerName: string;
  sandwichCost: number;
  isCaptain: boolean;
  slotType: "batting" | "bowling" | "allrounder";
  isWicketkeeper: boolean;
  photoUrl: string | null;
}

export interface ShareTeamData {
  ownerName: string;
  season: string;
  totalSandwichCost: number;
  gameweekLabel: string;
  players: SharePlayer[];
}

const SIZE = 1080;
const CLUB_GREEN = "#1B3D2F";
const CLUB_GREEN_LIGHT = "#2A5C46";
const GOLD_ACCENT = "#D4A843";
const CARD_BG = "rgba(255, 255, 255, 0.12)";
const CARD_BG_CAPTAIN = "rgba(212, 168, 67, 0.2)";
const TEXT_WHITE = "#FFFFFF";
const TEXT_LIGHT = "rgba(255, 255, 255, 0.8)";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCircularImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  radius: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // Cover-fit the image into the circle
  const aspect = img.width / img.height;
  let sw = img.width;
  let sh = img.height;
  if (aspect > 1) {
    sw = sh;
  } else {
    sh = sw;
  }
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;

  ctx.drawImage(
    img,
    sx,
    sy,
    sw,
    sh,
    cx - radius,
    cy - radius,
    radius * 2,
    radius * 2,
  );
  ctx.restore();
}

function drawPlayerCard(
  ctx: CanvasRenderingContext2D,
  player: SharePlayer,
  photo: HTMLImageElement | null,
  x: number,
  y: number,
  cardW: number,
  cardH: number,
) {
  // Card background
  ctx.fillStyle = player.isCaptain ? CARD_BG_CAPTAIN : CARD_BG;
  drawRoundedRect(ctx, x, y, cardW, cardH, 10);
  ctx.fill();

  // Subtle border
  ctx.strokeStyle = player.isCaptain
    ? "rgba(212, 168, 67, 0.5)"
    : "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, x, y, cardW, cardH, 10);
  ctx.stroke();

  const centerX = x + cardW / 2;
  const photoRadius = 36;
  const photoY = y + 14 + photoRadius;

  // Player photo or placeholder
  if (photo) {
    drawCircularImage(ctx, photo, centerX, photoY, photoRadius);
  } else {
    // Draw a subtle placeholder circle
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    ctx.arc(centerX, photoY, photoRadius, 0, Math.PI * 2);
    ctx.fill();

    // Silhouette icon
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.beginPath();
    ctx.arc(centerX, photoY - 6, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(centerX, photoY + 18, 18, 12, 0, Math.PI, 0, true);
    ctx.fill();
  }

  // Player name (truncate if needed)
  let nameY = photoY + photoRadius + 16;
  ctx.fillStyle = TEXT_WHITE;
  ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";

  const nameParts = player.playerName.split(" ");
  // Show surname on first line, first initial on second if long
  if (nameParts.length >= 2) {
    const firstName = nameParts[0];
    const surname = nameParts.slice(1).join(" ");

    // Check if full name fits
    const fullName = player.playerName;
    const metrics = ctx.measureText(fullName);
    if (metrics.width > cardW - 12) {
      // First initial + surname
      ctx.fillText(`${firstName[0]}. ${surname}`, centerX, nameY, cardW - 12);
    } else {
      ctx.fillText(fullName, centerX, nameY, cardW - 12);
    }
  } else {
    ctx.fillText(player.playerName, centerX, nameY, cardW - 12);
  }

  // Sandwich cost — use text with single emoji for cross-platform reliability
  nameY += 20;
  ctx.font = "15px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillStyle = GOLD_ACCENT;
  ctx.fillText(`${player.sandwichCost} x 🥪`, centerX, nameY, cardW - 8);

  // Captain / WK badge
  const badgeY = nameY + 18;
  if (player.isCaptain) {
    ctx.fillStyle = GOLD_ACCENT;
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("CAPTAIN", centerX, badgeY);
  } else if (player.isWicketkeeper) {
    ctx.fillStyle = TEXT_LIGHT;
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("WK", centerX, badgeY);
  }
}

export async function generateTeamImage(
  data: ShareTeamData,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  // --- Background gradient ---
  const gradient = ctx.createLinearGradient(0, 0, 0, SIZE);
  gradient.addColorStop(0, CLUB_GREEN);
  gradient.addColorStop(1, CLUB_GREEN_LIGHT);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Subtle pattern overlay
  ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
  for (let i = 0; i < SIZE; i += 40) {
    ctx.fillRect(0, i, SIZE, 1);
  }

  // --- Load images in parallel ---
  const logoPromise = loadImage("/images/club_logo.png").catch(() => null);
  const anonPromise = loadImage("/images/anon.jpg").catch(() => null);
  const photoPromises = data.players.map((p) =>
    p.photoUrl ? loadImage(p.photoUrl).catch(() => null) : Promise.resolve(null),
  );

  const [logo, anonImg, ...playerPhotos] = await Promise.all([
    logoPromise,
    anonPromise,
    ...photoPromises,
  ]);

  // --- Header ---
  const headerY = 24;

  // Club logo (left side)
  if (logo) {
    const logoSize = 80;
    ctx.drawImage(logo, 28, headerY, logoSize, logoSize);
  }

  // Manager name — large and prominent
  ctx.fillStyle = TEXT_WHITE;
  ctx.textAlign = "center";
  ctx.font = "bold 42px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(`${data.ownerName}'s XI`, SIZE / 2, headerY + 38);

  // Season + gameweek subtitle
  ctx.fillStyle = GOLD_ACCENT;
  ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(data.gameweekLabel, SIZE / 2, headerY + 64);

  // Season line
  ctx.fillStyle = TEXT_LIGHT;
  ctx.font = "16px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(
    `Percy Main Fantasy Cricket ${data.season}`,
    SIZE / 2,
    headerY + 86,
  );

  // Divider line
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, headerY + 100);
  ctx.lineTo(SIZE - 60, headerY + 100);
  ctx.stroke();

  // --- Player cards ---
  if (data.players.length < 11) {
    throw new Error(
      `Cannot generate share image: team has ${data.players.length} players (need 11)`,
    );
  }

  // Layout: 3 rows arranged like a cricket formation
  // Row 1 (top): 4 batting slots
  // Row 2 (middle): 3 players (remaining batters + allrounder)
  // Row 3 (bottom): 4 bowling slots

  const batters = data.players.filter((p) => p.slotType === "batting");
  const allrounders = data.players.filter((p) => p.slotType === "allrounder");
  const bowlers = data.players.filter((p) => p.slotType === "bowling");

  // Build rows: we need the original indices for photo lookup
  const allOrdered = [...batters, ...allrounders, ...bowlers];
  const indexMap = allOrdered.map((p) => data.players.indexOf(p));

  const rows = [
    allOrdered.slice(0, 4), // 4 batters
    allOrdered.slice(4, 7), // 2 batters + 1 allrounder (or similar)
    allOrdered.slice(7, 11), // bowlers
  ];
  const rowIndices = [
    indexMap.slice(0, 4),
    indexMap.slice(4, 7),
    indexMap.slice(7, 11),
  ];

  const cardW = 155;
  const cardH = 175;
  const startY = headerY + 120;
  const rowGap = 20;

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const indices = rowIndices[rowIdx];
    const rowY = startY + rowIdx * (cardH + rowGap);
    const totalRowWidth = row.length * cardW + (row.length - 1) * 16;
    const startX = (SIZE - totalRowWidth) / 2;

    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const player = row[colIdx];
      const originalIdx = indices[colIdx];
      const photo = playerPhotos[originalIdx] ?? anonImg;
      const x = startX + colIdx * (cardW + 16);
      drawPlayerCard(ctx, player, photo, x, rowY, cardW, cardH);
    }
  }

  // --- Footer ---
  const footerY = SIZE - 100;

  // Divider
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, footerY);
  ctx.lineTo(SIZE - 60, footerY);
  ctx.stroke();

  // Total sandwich spend
  ctx.textAlign = "center";
  ctx.fillStyle = GOLD_ACCENT;
  ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(
    `Total: ${data.totalSandwichCost} 🥪`,
    SIZE / 2,
    footerY + 30,
  );

  // Web address
  ctx.fillStyle = TEXT_WHITE;
  ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("percymain.org/fantasy", SIZE / 2, footerY + 58);

  // Club logo in bottom-right corner
  if (logo) {
    const smallLogo = 40;
    ctx.globalAlpha = 0.5;
    ctx.drawImage(logo, SIZE - 30 - smallLogo, footerY + 18, smallLogo, smallLogo);
    ctx.globalAlpha = 1;
  }

  // --- Export ---
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to generate image"));
      },
      "image/png",
    );
  });
}
