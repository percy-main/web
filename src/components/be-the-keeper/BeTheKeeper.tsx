import { useRef, useEffect, useState, useCallback } from "react";
import { useSession } from "@/lib/auth/client";
import { actions } from "astro:actions";

// ══════════════════════════════════════════════════════════════
//  BE THE KEEPER — Percy Main CC Wicketkeeper Catching Game
// ══════════════════════════════════════════════════════════════

const P = {
  sky: ["#6AABDB", "#B8DCF0"] as const,
  grass: "#2B7A2F",
  grassAlt: "#35893A",
  pitch: "#C9A96A",
  pitchDark: "#B89858",
  crease: "rgba(255,255,255,0.85)",
  stump: "#BA8040",
  stumpLight: "#D4A050",
  bail: "#DDB860",
  ball: "#7B1A1A",
  ballLight: "#A83030",
  ballDark: "#501010",
  seam: "#D4A040",
  percy: "#1B3D2F",
  percyLight: "#2D5A45",
  glovePalm: "#D4B87A",
  white: "#FFF",
  cta: "#FE6019",
  gold: "#FEE140",
  caught: "#66BB6A",
  dropped: "#EF5350",
  helmet: "#333840",
  helmetDark: "#1a1e24",
  grille: "#6a7080",
};

const BOWLERS = [
  { name: "Steve Knight", quip: "Throwing grenades, not bowling" },
  { name: "Alex Young", quip: "Watch out for the one that doesn't turn" },
  { name: "Hari Subramanian", quip: "How will he bowl it this time?!" },
  { name: "Josh Thelwell", quip: "He nets at uni you know!" },
  { name: "Phil Cramman", quip: "In his one game this season" },
  { name: "Aiden Pieters", quip: "Gone but not forgotten" },
];

const BOWLING_ENDS = [
  "the Blyth Duncan Jnr End",
  "the St. John's Terrace End",
];

const MAX_LIVES = 3;
const CATCHES_PER_LEVEL = 5;
const GAP_BETWEEN = 0.9;

// ── Types ───────────────────────────────────────────────────

interface Delivery {
  targetX: number;
  progress: number;
  speed: number;
  swing: number;
  seam: number;
  bounceZ: number;
  bounceH: number;
  active: boolean;
  bouncePlayed: boolean;
  late: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  r: number;
}

interface PopText {
  text: string;
  x: number;
  y: number;
  life: number;
  color: string;
  size: number;
}

interface LeaderboardEntry {
  name: string;
  score: number;
  level: number;
  catches: number;
  bestStreak: number;
}

interface GS {
  phase: "menu" | "play" | "over";
  score: number;
  level: number;
  lives: number;
  streak: number;
  bestStreak: number;
  catches: number;
  catchesInLvl: number;
  ball: Delivery | null;
  gap: number;
  mx: number;
  my: number;
  sparks: Spark[];
  pops: PopText[];
  flash: { c: string; a: number } | null;
  hi: number;
  gloveSpread: number;
  shakeX: number;
  shakeY: number;
  totalBalls: number;
  bowlerAnnounce: number;
  batSwing: number;
  overPause: number;
  gameOverTime: number;
  leaderboard: LeaderboardEntry[];
  scoreSaved: boolean;
}

// ── State ───────────────────────────────────────────────────

function initState(): GS {
  let hi = 0;
  try {
    hi = parseInt(localStorage.getItem("pmcc_keeper_hi") || "0", 10);
  } catch {}
  return {
    phase: "menu",
    score: 0,
    level: 1,
    lives: MAX_LIVES,
    streak: 0,
    bestStreak: 0,
    catches: 0,
    catchesInLvl: 0,
    ball: null,
    gap: 0.5,
    mx: 0.5,
    my: 0.75,
    sparks: [],
    pops: [],
    flash: null,
    hi,
    gloveSpread: 1,
    shakeX: 0,
    shakeY: 0,
    totalBalls: 0,
    bowlerAnnounce: 0,
    batSwing: 0,
    overPause: 0,
    gameOverTime: 0,
    leaderboard: [],
    scoreSaved: false,
  };
}

// ── Ball creation ───────────────────────────────────────────

function mkBall(lvl: number): Delivery {
  const speed = 0.38 + lvl * 0.09 + Math.random() * 0.06;
  const range = Math.min(0.25 + lvl * 0.12, 0.9);
  const targetX = (Math.random() * 2 - 1) * range;
  const swMax = Math.min(0.05 + lvl * 0.12, 0.7);
  const swing = (Math.random() * 2 - 1) * swMax;
  const smMax = Math.min(lvl * 0.09, 0.4);
  const seam = (Math.random() * 2 - 1) * smMax;
  const late = lvl >= 3 ? Math.min((lvl - 2) * 0.12, 0.5) * Math.random() : 0;

  return {
    targetX,
    progress: 0,
    speed,
    swing,
    seam,
    bounceZ: 0.35 + Math.random() * 0.22,
    bounceH: 0.15 + Math.random() * 0.55,
    active: true,
    bouncePlayed: false,
    late,
  };
}

// ── Ball screen position ────────────────────────────────────

function ballPos(b: Delivery, w: number, h: number) {
  const p = b.progress;
  const t = Math.pow(p, 1.5);

  const hy = h * 0.22;
  const stumpY = h * 0.72;
  const pitchY = h * 0.85;

  const arrX = w / 2 + b.targetX * w * 0.38;
  // Late swing kicks in more after bounce
  const lateFactor = b.late * Math.pow(Math.max(0, p - 0.5) * 2, 2);
  const swPx = b.swing * w * 0.18 * p * p + Math.sign(b.swing) * lateFactor * w * 0.12;
  let smPx = 0;
  if (p > b.bounceZ) {
    smPx = b.seam * w * 0.14 * ((p - b.bounceZ) / (1 - b.bounceZ));
  }
  const x = w / 2 + (arrX - w / 2 + swPx + smPx) * t;

  let y: number;
  if (p <= b.bounceZ) {
    const bt = p / b.bounceZ;
    const pitchAtBounce = hy + (pitchY - hy) * Math.pow(b.bounceZ, 1.5);
    y = hy + (pitchAtBounce - hy) * Math.pow(bt, 1.1);
  } else {
    const bt = (p - b.bounceZ) / (1 - b.bounceZ);
    const pitchAtBounce = hy + (pitchY - hy) * Math.pow(b.bounceZ, 1.5);
    const peakY = pitchAtBounce - b.bounceH * h * 0.14;
    const inv = 1 - bt;
    y = inv * inv * pitchAtBounce + 2 * inv * bt * peakY + bt * bt * stumpY;
  }

  const r = 3 + 16 * t;
  return { x, y, r };
}

// ── Effects helpers ─────────────────────────────────────────

function addSparks(s: GS, x: number, y: number, color: string, n: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 40 + Math.random() * 120;
    s.sparks.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 0.3 + Math.random() * 0.4,
      max: 0.3 + Math.random() * 0.4,
      color,
      r: 2 + Math.random() * 3,
    });
  }
}

function addPop(s: GS, text: string, x: number, y: number, color: string, size = 26) {
  s.pops.push({ text, x, y, life: 1.2, color, size });
}

// ── Audio ───────────────────────────────────────────────────

let audioCtx: AudioContext | null = null;

function getAudio(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playSound(type: "catch" | "drop" | "bounce") {
  try {
    const ctx = getAudio();
    if (ctx.state === "suspended") ctx.resume();
    if (type === "catch") {
      const len = Math.floor(ctx.sampleRate * 0.07);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++)
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.012));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = "bandpass";
      filt.frequency.value = 2500;
      filt.Q.value = 1.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      src.connect(filt);
      filt.connect(g);
      g.connect(ctx.destination);
      src.start();
    } else if (type === "drop") {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.22);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } else {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = 170;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.07, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    }
  } catch {
    /* audio unavailable */
  }
}

// ── Drawing helpers ─────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
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

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.05, x, y, r);
  grad.addColorStop(0, P.ballLight);
  grad.addColorStop(0.6, P.ball);
  grad.addColorStop(1, P.ballDark);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  if (r > 5) {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.6, -0.7, 0.7);
    ctx.strokeStyle = P.seam;
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fill();
}

function drawGloves(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, spread: number,
) {
  const gw = Math.min(w * 0.06, 46);
  const gh = gw * 1.25;
  const gap = gw * 0.35 + spread * gw * 0.65;

  for (const side of [-1, 1] as const) {
    const gx = x + side * gap;
    ctx.save();
    if (side === 1) {
      ctx.translate(gx, y);
      ctx.scale(-1, 1);
      ctx.translate(-gx, -y);
    }
    ctx.beginPath();
    ctx.moveTo(gx - gw * 0.4, y - gh * 0.3);
    ctx.quadraticCurveTo(gx - gw * 0.45, y - gh * 0.5, gx - gw * 0.15, y - gh * 0.52);
    ctx.quadraticCurveTo(gx + gw * 0.15, y - gh * 0.55, gx + gw * 0.35, y - gh * 0.45);
    ctx.quadraticCurveTo(gx + gw * 0.5, y - gh * 0.3, gx + gw * 0.45, y - gh * 0.05);
    ctx.quadraticCurveTo(gx + gw * 0.5, y + gh * 0.2, gx + gw * 0.35, y + gh * 0.35);
    ctx.quadraticCurveTo(gx + gw * 0.15, y + gh * 0.48, gx, y + gh * 0.48);
    ctx.quadraticCurveTo(gx - gw * 0.25, y + gh * 0.48, gx - gw * 0.4, y + gh * 0.3);
    ctx.quadraticCurveTo(gx - gw * 0.5, y + gh * 0.1, gx - gw * 0.4, y - gh * 0.3);
    ctx.closePath();
    ctx.fillStyle = P.percy;
    ctx.fill();
    ctx.strokeStyle = P.percyLight;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(gx, y, gw * 0.22, gh * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = P.glovePalm;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    for (let f = -1; f <= 1; f++) {
      ctx.beginPath();
      ctx.moveTo(gx + f * gw * 0.1, y - gh * 0.3);
      ctx.lineTo(gx + f * gw * 0.1, y - gh * 0.12);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (spread < 0.4) {
    ctx.globalAlpha = (1 - spread / 0.4) * 0.3;
    ctx.beginPath();
    ctx.moveTo(x - gap * 0.4, y - gh * 0.25);
    ctx.quadraticCurveTo(x, y - gh * 0.45, x + gap * 0.4, y - gh * 0.25);
    ctx.quadraticCurveTo(x, y - gh * 0.05, x - gap * 0.4, y - gh * 0.25);
    ctx.fillStyle = P.glovePalm;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ── Batter ──────────────────────────────────────────────────

function drawBatter(ctx: CanvasRenderingContext2D, w: number, h: number, swing: number) {
  const cx = w / 2;
  const footY = h * 0.76;
  const scale = h * 0.0018;

  ctx.save();
  ctx.translate(cx + w * 0.02, footY);
  ctx.scale(scale, scale);

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 35, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs - slight stride when swinging
  const stride = swing * 4;
  ctx.fillStyle = "#e8e0d0";
  ctx.beginPath();
  ctx.moveTo(-8 - stride, 0);
  ctx.lineTo(-12, -60);
  ctx.lineTo(-4, -60);
  ctx.lineTo(-2 - stride, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(4 + stride, 0);
  ctx.lineTo(6, -60);
  ctx.lineTo(14, -60);
  ctx.lineTo(10 + stride, 0);
  ctx.fill();

  // Pads
  ctx.fillStyle = "#f0ece4";
  ctx.fillRect(-14 - stride, -30, 10, 30);
  ctx.fillRect(4 + stride, -30, 10, 30);
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 0.5;
  ctx.strokeRect(-14 - stride, -30, 10, 30);
  ctx.strokeRect(4 + stride, -30, 10, 30);

  // Body - slight rotation when swinging
  ctx.save();
  ctx.rotate(swing * -0.15);

  ctx.fillStyle = "#f5f2ec";
  ctx.beginPath();
  ctx.moveTo(-10, -60);
  ctx.quadraticCurveTo(-14, -85, -10, -110);
  ctx.lineTo(12, -110);
  ctx.quadraticCurveTo(16, -85, 12, -60);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.06)";
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Arms follow the bat
  ctx.fillStyle = "#e8dcc8";
  ctx.beginPath();
  ctx.moveTo(10, -100);
  ctx.quadraticCurveTo(28, -95, 30, -80);
  ctx.lineTo(26, -78);
  ctx.quadraticCurveTo(24, -92, 8, -96);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-10, -100);
  ctx.quadraticCurveTo(-22, -88, -18, -78);
  ctx.lineTo(-14, -80);
  ctx.quadraticCurveTo(-18, -90, -8, -96);
  ctx.closePath();
  ctx.fill();

  // Bat - swings through with ball
  ctx.save();
  ctx.translate(28, -80);
  const batAngle = -0.6 + swing * 2.2;
  ctx.rotate(batAngle);
  ctx.fillStyle = "#c8a86a";
  ctx.fillRect(-1.5, -45, 3, 30);
  ctx.fillStyle = "#d4c090";
  ctx.fillRect(-2, -45, 4, 10);
  ctx.fillStyle = "#e8d8a8";
  ctx.beginPath();
  ctx.moveTo(-5, -15);
  ctx.lineTo(5, -15);
  ctx.lineTo(6, 25);
  ctx.quadraticCurveTo(0, 28, -6, 25);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.1)";
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.restore();

  // Helmet
  ctx.fillStyle = P.percy;
  ctx.beginPath();
  ctx.arc(1, -120, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = P.percyLight;
  ctx.beginPath();
  ctx.moveTo(-10, -116);
  ctx.quadraticCurveTo(1, -108, 12, -116);
  ctx.lineTo(14, -118);
  ctx.quadraticCurveTo(1, -112, -12, -118);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(200,200,200,0.25)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-5, -116);
  ctx.lineTo(-3, -110);
  ctx.moveTo(1, -116);
  ctx.lineTo(1, -110);
  ctx.moveTo(7, -116);
  ctx.lineTo(5, -110);
  ctx.stroke();

  ctx.restore(); // body rotation
  ctx.restore(); // main transform
}

// ── Keeper arms ─────────────────────────────────────────────

function drawKeeperArms(
  ctx: CanvasRenderingContext2D,
  gx: number, gy: number, w: number, h: number,
) {
  ctx.lineWidth = Math.max(w * 0.018, 8);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const side of [-1, 1] as const) {
    const shoulderX = w / 2 + side * w * 0.42;
    const shoulderY = h + 10;
    const elbowX = shoulderX + (gx - shoulderX) * 0.4 + side * w * 0.04;
    const elbowY = shoulderY + (gy - shoulderY) * 0.55 + 15;
    const wristX = gx + side * Math.min(w * 0.035, 26);
    const wristY = gy + 8;

    // Arm shadow
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = Math.max(w * 0.022, 10);
    ctx.beginPath();
    ctx.moveTo(shoulderX + 2, shoulderY + 2);
    ctx.quadraticCurveTo(elbowX + 2, elbowY + 2, wristX + 2, wristY + 2);
    ctx.stroke();

    // Sleeve (white cricket shirt)
    ctx.strokeStyle = "#f0ece4";
    ctx.lineWidth = Math.max(w * 0.02, 9);
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.quadraticCurveTo(elbowX, elbowY, wristX, wristY);
    ctx.stroke();

    // Forearm/inner arm (skin)
    ctx.strokeStyle = "#e8dcc8";
    ctx.lineWidth = Math.max(w * 0.015, 7);
    ctx.beginPath();
    const midX = (elbowX + wristX) / 2;
    const midY = (elbowY + wristY) / 2;
    ctx.moveTo(elbowX, elbowY);
    ctx.quadraticCurveTo(midX, midY, wristX, wristY);
    ctx.stroke();
  }
}

// ── Helmet grille overlay ───────────────────────────────────

function drawHelmet(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // ── Helmet shell surround ──
  // Thick dark border all around the edge, like looking through the opening
  const shellT = Math.max(w * 0.04, 18); // top thickness
  const shellB = Math.max(w * 0.035, 16); // bottom
  const shellS = Math.max(w * 0.03, 14); // sides

  // Solid shell edges
  ctx.fillStyle = P.helmetDark;
  // Top
  ctx.fillRect(0, 0, w, shellT);
  // Bottom
  ctx.fillRect(0, h - shellB, w, shellB);
  // Left
  ctx.fillRect(0, 0, shellS, h);
  // Right
  ctx.fillRect(w - shellS, 0, shellS, h);

  // Rounded inner corners with gradients to soften the transition
  const cornerR = Math.max(w * 0.06, 30);

  // Inner shadow/bevel to give depth
  ctx.save();
  // Top inner bevel
  const topBevel = ctx.createLinearGradient(0, shellT, 0, shellT + cornerR);
  topBevel.addColorStop(0, "rgba(26,30,36,0.6)");
  topBevel.addColorStop(1, "transparent");
  ctx.fillStyle = topBevel;
  ctx.fillRect(shellS, shellT, w - shellS * 2, cornerR);

  // Bottom inner bevel
  const botBevel = ctx.createLinearGradient(0, h - shellB, 0, h - shellB - cornerR);
  botBevel.addColorStop(0, "rgba(26,30,36,0.5)");
  botBevel.addColorStop(1, "transparent");
  ctx.fillStyle = botBevel;
  ctx.fillRect(shellS, h - shellB - cornerR, w - shellS * 2, cornerR);

  // Left inner bevel
  const leftBevel = ctx.createLinearGradient(shellS, 0, shellS + cornerR, 0);
  leftBevel.addColorStop(0, "rgba(26,30,36,0.5)");
  leftBevel.addColorStop(1, "transparent");
  ctx.fillStyle = leftBevel;
  ctx.fillRect(shellS, shellT, cornerR, h - shellT - shellB);

  // Right inner bevel
  const rightBevel = ctx.createLinearGradient(w - shellS, 0, w - shellS - cornerR, 0);
  rightBevel.addColorStop(0, "rgba(26,30,36,0.5)");
  rightBevel.addColorStop(1, "transparent");
  ctx.fillStyle = rightBevel;
  ctx.fillRect(w - shellS - cornerR, shellT, cornerR, h - shellT - shellB);

  // Subtle highlight on top edge of shell (metallic look)
  ctx.fillStyle = "rgba(100,110,130,0.15)";
  ctx.fillRect(shellS, shellT - 2, w - shellS * 2, 2);

  // Corner fill (rounded look) - draw filled arcs in corners
  ctx.fillStyle = P.helmetDark;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(shellS, shellT);
  ctx.lineTo(shellS + cornerR, shellT);
  ctx.quadraticCurveTo(shellS, shellT, shellS, shellT + cornerR);
  ctx.closePath();
  ctx.fill();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(w - shellS, shellT);
  ctx.lineTo(w - shellS - cornerR, shellT);
  ctx.quadraticCurveTo(w - shellS, shellT, w - shellS, shellT + cornerR);
  ctx.closePath();
  ctx.fill();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(shellS, h - shellB);
  ctx.lineTo(shellS + cornerR, h - shellB);
  ctx.quadraticCurveTo(shellS, h - shellB, shellS, h - shellB - cornerR);
  ctx.closePath();
  ctx.fill();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(w - shellS, h - shellB);
  ctx.lineTo(w - shellS - cornerR, h - shellB);
  ctx.quadraticCurveTo(w - shellS, h - shellB, w - shellS, h - shellB - cornerR);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Extra vignette for depth
  const vig = ctx.createRadialGradient(w / 2, h * 0.45, w * 0.28, w / 2, h * 0.45, w * 0.62);
  vig.addColorStop(0, "transparent");
  vig.addColorStop(0.75, "transparent");
  vig.addColorStop(1, "rgba(26,30,36,0.35)");
  ctx.fillStyle = vig;
  ctx.fillRect(shellS, shellT, w - shellS * 2, h - shellT - shellB);

  // ── Grille bars ──
  ctx.strokeStyle = P.grille;
  ctx.lineWidth = Math.max(2.5, w * 0.004);
  ctx.lineCap = "round";

  const barCount = 9;
  const yTop = 0;
  const yBot = h * 0.58;
  const topSpread = w * 0.5;
  const botSpread = w * 0.56;

  for (let i = 0; i < barCount; i++) {
    const t = i / (barCount - 1);
    const xt = w / 2 + (t - 0.5) * 2 * topSpread;
    const xb = w / 2 + (t - 0.5) * 2 * botSpread;
    const cp1x = xt + (xb - xt) * 0.3;
    const cp1y = yTop + (yBot - yTop) * 0.35;
    const cp2x = xb - (xb - xt) * 0.1;
    const cp2y = yTop + (yBot - yTop) * 0.7;

    // Shadow
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = Math.max(4, w * 0.006);
    ctx.beginPath();
    ctx.moveTo(xt + 1, yTop + 1);
    ctx.bezierCurveTo(cp1x + 1, cp1y + 1, cp2x + 1, cp2y + 1, xb + 1, yBot + 1);
    ctx.stroke();

    // Bar
    ctx.strokeStyle = P.grille;
    ctx.lineWidth = Math.max(2.5, w * 0.004);
    ctx.beginPath();
    ctx.moveTo(xt, yTop);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, xb, yBot);
    ctx.stroke();

    // Highlight
    ctx.strokeStyle = "rgba(160,170,190,0.3)";
    ctx.lineWidth = Math.max(1, w * 0.0015);
    ctx.beginPath();
    ctx.moveTo(xt - 1, yTop);
    ctx.bezierCurveTo(cp1x - 1, cp1y, cp2x - 1, cp2y, xb - 1, yBot);
    ctx.stroke();
  }

  // Horizontal cross-bars
  const hBars = 3;
  for (let j = 0; j < hBars; j++) {
    const t = (j + 1) / (hBars + 1);
    const yy = shellT + (yBot - shellT) * t;
    const spread = topSpread + (botSpread - topSpread) * t;
    const xl = w / 2 - spread - shellS;
    const xr = w / 2 + spread + shellS;
    const sag = 4 + t * 3;

    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = Math.max(3, w * 0.005);
    ctx.beginPath();
    ctx.moveTo(xl + 1, yy + 1);
    ctx.quadraticCurveTo(w / 2 + 1, yy + sag + 1, xr + 1, yy + 1);
    ctx.stroke();

    ctx.strokeStyle = P.grille;
    ctx.lineWidth = Math.max(2, w * 0.003);
    ctx.beginPath();
    ctx.moveTo(xl, yy);
    ctx.quadraticCurveTo(w / 2, yy + sag, xr, yy);
    ctx.stroke();

    ctx.strokeStyle = "rgba(160,170,190,0.2)";
    ctx.lineWidth = Math.max(1, w * 0.0012);
    ctx.beginPath();
    ctx.moveTo(xl, yy - 1);
    ctx.quadraticCurveTo(w / 2, yy + sag - 1, xr, yy - 1);
    ctx.stroke();
  }
}

// ── Scene drawing ───────────────────────────────────────────

function drawScene(ctx: CanvasRenderingContext2D, s: GS, w: number, h: number, isLoggedIn: boolean) {
  ctx.save();
  ctx.translate(s.shakeX, s.shakeY);

  const hy = h * 0.22;

  // Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, hy);
  skyGrad.addColorStop(0, P.sky[0]);
  skyGrad.addColorStop(1, P.sky[1]);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, hy + 2);

  // Outfield stripes
  for (let i = 0; i < 14; i++) {
    const d1 = i / 14;
    const d2 = (i + 1) / 14;
    const y1 = hy + (h - hy) * Math.pow(d1, 1.3);
    const y2 = hy + (h - hy) * Math.pow(d2, 1.3);
    ctx.fillStyle = i % 2 === 0 ? P.grass : P.grassAlt;
    ctx.fillRect(0, y1, w, y2 - y1 + 1);
  }

  // Pitch strip
  const pn = w * 0.025;
  const pw = w * 0.22;
  ctx.beginPath();
  ctx.moveTo(w / 2 - pn, hy);
  ctx.lineTo(w / 2 + pn, hy);
  ctx.lineTo(w / 2 + pw, h);
  ctx.lineTo(w / 2 - pw, h);
  ctx.closePath();
  const pGrad = ctx.createLinearGradient(0, hy, 0, h);
  pGrad.addColorStop(0, P.pitchDark);
  pGrad.addColorStop(1, P.pitch);
  ctx.fillStyle = pGrad;
  ctx.fill();

  // Worn patch
  ctx.fillStyle = "rgba(0,0,0,0.04)";
  const wornW = pw * 0.3;
  ctx.fillRect(w / 2 - wornW, h * 0.5, wornW * 2, h * 0.18);

  // Crease
  const creaseY = h * 0.74;
  const creaseHW = pw * 0.85;
  ctx.strokeStyle = P.crease;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w / 2 - creaseHW, creaseY);
  ctx.lineTo(w / 2 + creaseHW, creaseY);
  ctx.stroke();

  // Stumps
  const stH = h * 0.055;
  const stW = 3;
  const stGap = 7;
  for (let i = -1; i <= 1; i++) {
    const sx = w / 2 + i * stGap;
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(sx - stW / 2 + 2, creaseY - stH + 2, stW, stH);
    const sg = ctx.createLinearGradient(sx - stW, 0, sx + stW, 0);
    sg.addColorStop(0, P.stump);
    sg.addColorStop(0.5, P.stumpLight);
    sg.addColorStop(1, P.stump);
    ctx.fillStyle = sg;
    ctx.fillRect(sx - stW / 2, creaseY - stH, stW, stH);
  }
  ctx.fillStyle = P.bail;
  ctx.fillRect(w / 2 - stGap - 4, creaseY - stH - 2, stGap * 2 + 8, 2.5);

  // Batter
  drawBatter(ctx, w, h, s.batSwing);

  // Ball
  if (s.ball && s.ball.active) {
    const bp = ballPos(s.ball, w, h);
    const shadowT = Math.pow(s.ball.progress, 1.5);
    const groundY = hy + (h * 0.85 - hy) * shadowT;
    ctx.beginPath();
    ctx.ellipse(bp.x, groundY, bp.r * 1.2, bp.r * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,0,0,${0.1 * shadowT})`;
    ctx.fill();
    for (let i = 4; i >= 1; i--) {
      const tp = Math.max(0, s.ball.progress - i * 0.025);
      const tb = ballPos({ ...s.ball, progress: tp }, w, h);
      ctx.beginPath();
      ctx.arc(tb.x, tb.y, tb.r * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(123,26,26,${0.06 * (5 - i)})`;
      ctx.fill();
    }
    drawBall(ctx, bp.x, bp.y, bp.r);
  }

  // Keeper arms + Gloves
  const gx = s.mx * w;
  const gy = s.my * h;
  drawKeeperArms(ctx, gx, gy, w, h);
  drawGloves(ctx, gx, gy, w, s.gloveSpread);

  // Sparks
  for (const sp of s.sparks) {
    ctx.globalAlpha = sp.life / sp.max;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.r * (sp.life / sp.max), 0, Math.PI * 2);
    ctx.fillStyle = sp.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Pop text
  for (const pt of s.pops) {
    const a = Math.min(1, pt.life * 2);
    ctx.globalAlpha = a;
    ctx.font = `bold ${pt.size}px 'Source Sans 3', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 3;
    ctx.strokeText(pt.text, pt.x, pt.y);
    ctx.fillStyle = pt.color;
    ctx.fillText(pt.text, pt.x, pt.y);
  }
  ctx.globalAlpha = 1;

  // Flash
  if (s.flash && s.flash.a > 0.01) {
    ctx.globalAlpha = s.flash.a;
    ctx.fillStyle = s.flash.c;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  // Low-lives vignette
  if (s.phase === "play" && s.lives <= 1) {
    const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7);
    vig.addColorStop(0, "transparent");
    vig.addColorStop(1, "rgba(180,0,0,0.1)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  // Helmet grille (always on top of scene)
  if (s.phase === "play") {
    drawHelmet(ctx, w, h);
  }

  // HUD / overlays
  if (s.phase === "play") drawHUD(ctx, s, w, h);
  if (s.phase === "menu") drawMenu(ctx, s, w, h);
  if (s.phase === "over") drawGameOver(ctx, s, w, h, isLoggedIn);

  ctx.restore();
}

// ── HUD ─────────────────────────────────────────────────────

function drawHUD(ctx: CanvasRenderingContext2D, s: GS, w: number, h: number) {
  const pad = 10;
  const hudH = 36;

  ctx.fillStyle = "rgba(27,61,47,0.9)";
  roundRect(ctx, pad, h - pad - hudH, w - pad * 2, hudH, 8);
  ctx.fill();

  ctx.textBaseline = "middle";
  const cy = h - pad - hudH / 2;

  // Score
  ctx.textAlign = "left";
  ctx.font = `bold ${Math.min(w * 0.04, 18)}px 'Source Sans 3', sans-serif`;
  ctx.fillStyle = P.gold;
  ctx.fillText(String(s.score), pad + 14, cy);

  // Bowler name
  ctx.textAlign = "center";
  const bowler = BOWLERS[Math.min(s.level - 1, BOWLERS.length - 1)];
  ctx.font = `bold ${Math.min(w * 0.03, 14)}px 'Source Sans 3', sans-serif`;
  ctx.fillStyle = P.white;
  ctx.fillText(bowler.name, w / 2, cy - 5);

  // Progress
  const progW = 60;
  const progH = 3;
  const progX = w / 2 - progW / 2;
  const progY = cy + 9;
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  roundRect(ctx, progX, progY, progW, progH, 1.5);
  ctx.fill();
  ctx.fillStyle = P.gold;
  roundRect(ctx, progX, progY, progW * (s.catchesInLvl / CATCHES_PER_LEVEL), progH, 1.5);
  ctx.fill();

  // Streak
  if (s.streak >= 3) {
    ctx.font = `bold ${Math.min(w * 0.025, 11)}px 'Source Sans 3', sans-serif`;
    ctx.fillStyle = P.cta;
    ctx.fillText(`${s.streak}x STREAK`, w / 2, h - pad - hudH - 12);
  }

  // Lives
  ctx.textAlign = "right";
  for (let i = 0; i < MAX_LIVES; i++) {
    const lx = w - pad - 16 - i * 20;
    ctx.beginPath();
    ctx.arc(lx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = i < s.lives ? "#c03030" : "rgba(255,255,255,0.15)";
    ctx.fill();
  }

  // End-of-over / new bowler overlay
  if (s.overPause > 0) {
    const total = 3.0;
    const elapsed = total - s.overPause;
    const fadeIn = Math.min(1, elapsed * 3);
    const fadeOut = Math.min(1, s.overPause * 2);
    const a = Math.min(fadeIn, fadeOut);

    // Dark overlay
    ctx.globalAlpha = a * 0.7;
    ctx.fillStyle = "rgba(20,20,30,1)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = a;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // "End of Over"
    ctx.font = `bold ${Math.min(w * 0.04, 18)}px 'Source Sans 3', sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("END OF OVER", w / 2, h * 0.24);

    // Decorative line
    ctx.strokeStyle = `rgba(254,225,64,${a * 0.4})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.3, h * 0.29);
    ctx.lineTo(w * 0.7, h * 0.29);
    ctx.stroke();

    // Bowler name (big)
    ctx.font = `bold ${Math.min(w * 0.065, 34)}px 'Lora', serif`;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 3;
    ctx.strokeText(bowler.name, w / 2, h * 0.37);
    ctx.fillStyle = P.white;
    ctx.fillText(bowler.name, w / 2, h * 0.37);

    // "coming on to bowl"
    ctx.font = `${Math.min(w * 0.03, 15)}px 'Source Sans 3', sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    const end = BOWLING_ENDS[(s.level - 1) % BOWLING_ENDS.length];
    ctx.fillText(`coming on to bowl from ${end}`, w / 2, h * 0.44);

    // Quip
    ctx.font = `italic ${Math.min(w * 0.032, 16)}px 'Source Sans 3', sans-serif`;
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 2;
    ctx.strokeText(`"${bowler.quip}"`, w / 2, h * 0.53);
    ctx.fillStyle = P.gold;
    ctx.fillText(`"${bowler.quip}"`, w / 2, h * 0.53);

    ctx.globalAlpha = 1;
  }
}

// ── Menu screen ─────────────────────────────────────────────

function drawMenu(ctx: CanvasRenderingContext2D, s: GS, w: number, h: number) {
  // Helmet overlay for menu too
  drawHelmet(ctx, w, h);

  ctx.fillStyle = "rgba(27,61,47,0.78)";
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = `bold ${Math.min(w * 0.09, 48)}px 'Lora', serif`;
  ctx.fillStyle = P.white;
  ctx.fillText("BE THE KEEPER", w / 2, h * 0.24);

  ctx.font = `bold ${Math.min(w * 0.032, 16)}px 'Source Sans 3', sans-serif`;
  ctx.fillStyle = P.gold;
  ctx.fillText("PERCY MAIN CC", w / 2, h * 0.32);

  ctx.font = `${Math.min(w * 0.028, 14)}px 'Source Sans 3', sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("Move your gloves to catch the ball", w / 2, h * 0.44);
  ctx.fillText("Miss three and you're out!", w / 2, h * 0.50);

  const btnW = Math.min(w * 0.42, 200);
  const btnH = 44;
  const btnX = w / 2 - btnW / 2;
  const btnY = h * 0.59;
  ctx.fillStyle = P.cta;
  roundRect(ctx, btnX, btnY, btnW, btnH, 10);
  ctx.fill();
  ctx.font = `bold ${Math.min(w * 0.04, 20)}px 'Source Sans 3', sans-serif`;
  ctx.fillStyle = P.white;
  ctx.fillText("Play", w / 2, btnY + btnH / 2);

  if (s.hi > 0) {
    ctx.font = `${Math.min(w * 0.026, 13)}px 'Source Sans 3', sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText(`High Score: ${s.hi}`, w / 2, h * 0.76);
  }

  ctx.font = `${Math.min(w * 0.022, 12)}px 'Source Sans 3', sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillText("Mouse or touch to control", w / 2, h * 0.88);
}

// ── Game over ───────────────────────────────────────────────

function drawGameOver(
  ctx: CanvasRenderingContext2D, s: GS, w: number, h: number,
  isLoggedIn: boolean,
) {
  ctx.fillStyle = "rgba(20,20,40,0.88)";
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Compact layout: title + score
  ctx.font = `bold ${Math.min(w * 0.055, 32)}px 'Lora', serif`;
  ctx.fillStyle = P.white;
  ctx.fillText("INNINGS OVER", w / 2, h * 0.1);

  ctx.font = `bold ${Math.min(w * 0.085, 44)}px 'Lora', serif`;
  ctx.fillStyle = P.gold;
  ctx.fillText(String(s.score), w / 2, h * 0.19);

  if (s.score >= s.hi && s.score > 0) {
    ctx.font = `bold ${Math.min(w * 0.028, 14)}px 'Source Sans 3', sans-serif`;
    ctx.fillStyle = P.cta;
    ctx.fillText("NEW HIGH SCORE!", w / 2, h * 0.26);
  }

  // Stats row
  const bowler = BOWLERS[Math.min(s.level - 1, BOWLERS.length - 1)];
  ctx.font = `${Math.min(w * 0.024, 13)}px 'Source Sans 3', sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(
    `Bowler: ${bowler.name}  |  Catches: ${s.catches}/${s.totalBalls}  |  Best streak: ${s.bestStreak}`,
    w / 2, h * 0.32,
  );

  // Leaderboard section
  const lbTop = h * 0.38;
  if (s.leaderboard.length > 0) {
    ctx.font = `bold ${Math.min(w * 0.028, 14)}px 'Source Sans 3', sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText("TOP SCORES", w / 2, lbTop);

    const rowH = Math.min(h * 0.05, 22);
    const startY = lbTop + rowH * 1.2;
    const colName = w * 0.35;
    const colScore = w * 0.72;
    ctx.font = `${Math.min(w * 0.024, 13)}px 'Source Sans 3', sans-serif`;

    for (let i = 0; i < Math.min(s.leaderboard.length, 5); i++) {
      const entry = s.leaderboard[i];
      const y = startY + i * rowH;
      const isTop = i === 0;

      ctx.fillStyle = isTop ? P.gold : "rgba(255,255,255,0.65)";
      ctx.textAlign = "left";
      ctx.fillText(`${i + 1}.`, w * 0.28, y);
      ctx.fillText(entry.name.length > 16 ? entry.name.slice(0, 15) + "\u2026" : entry.name, colName, y);
      ctx.textAlign = "right";
      ctx.fillText(String(entry.score), colScore, y);
    }
    ctx.textAlign = "center";
  }

  // Auth prompt or saved status
  const promptY = s.leaderboard.length > 0
    ? lbTop + Math.min(h * 0.05, 22) * 1.2 + Math.min(s.leaderboard.length, 5) * Math.min(h * 0.05, 22) + 10
    : lbTop + 20;

  if (!isLoggedIn) {
    ctx.font = `${Math.min(w * 0.024, 13)}px 'Source Sans 3', sans-serif`;
    ctx.fillStyle = P.cta;
    const signUpText = "Sign up to save your score \u2192";
    ctx.fillText(signUpText, w / 2, promptY);
    // Store bounds for click detection
    const metrics = ctx.measureText(signUpText);
    (s as GS & { _signUpBounds?: { x: number; y: number; w: number; h: number } })._signUpBounds = {
      x: w / 2 - metrics.width / 2,
      y: promptY - 10,
      w: metrics.width,
      h: 20,
    };
  } else if (s.scoreSaved) {
    ctx.font = `${Math.min(w * 0.022, 12)}px 'Source Sans 3', sans-serif`;
    ctx.fillStyle = P.caught;
    ctx.fillText("Score saved!", w / 2, promptY);
  }

  // Leaderboard link
  if (s.leaderboard.length > 0) {
    const lbLinkY = promptY + 22;
    ctx.font = `${Math.min(w * 0.022, 12)}px 'Source Sans 3', sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    const lbLinkText = "View full leaderboard \u2192";
    ctx.fillText(lbLinkText, w / 2, lbLinkY);
    const lbMetrics = ctx.measureText(lbLinkText);
    (s as GS & { _lbLinkBounds?: { x: number; y: number; w: number; h: number } })._lbLinkBounds = {
      x: w / 2 - lbMetrics.width / 2,
      y: lbLinkY - 10,
      w: lbMetrics.width,
      h: 20,
    };
  }

  // Play again button
  const btnW = Math.min(w * 0.45, 210);
  const btnH = 44;
  const btnX = w / 2 - btnW / 2;
  const btnY = h * 0.85;
  const ready = s.gameOverTime > 1.5;
  const btnAlpha = ready ? 1 : Math.min(s.gameOverTime / 1.5, 0.3);
  ctx.globalAlpha = btnAlpha;
  ctx.fillStyle = ready ? P.cta : "#666";
  roundRect(ctx, btnX, btnY, btnW, btnH, 10);
  ctx.fill();
  ctx.font = `bold ${Math.min(w * 0.04, 20)}px 'Source Sans 3', sans-serif`;
  ctx.fillStyle = P.white;
  ctx.fillText("Play Again", w / 2, btnY + btnH / 2);
  ctx.globalAlpha = 1;
}

// ── Game update ─────────────────────────────────────────────

function update(s: GS, dt: number, w: number, h: number) {
  if (s.phase === "over") s.gameOverTime += Math.min(dt, 0.1);
  if (s.phase !== "play") return;
  dt = Math.min(dt, 0.1);

  s.shakeX *= 0.85;
  s.shakeY *= 0.85;
  if (Math.abs(s.shakeX) < 0.3) s.shakeX = 0;
  if (Math.abs(s.shakeY) < 0.3) s.shakeY = 0;

  if (s.flash) {
    s.flash.a -= dt * 3;
    if (s.flash.a <= 0) s.flash = null;
  }

  if (s.bowlerAnnounce > 0) {
    s.bowlerAnnounce -= dt;
  }

  if (s.overPause > 0) {
    s.overPause -= dt;
    // Don't progress game during over pause
    // Still update effects though
    for (const sp of s.sparks) {
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.vy += 180 * dt;
      sp.life -= dt;
    }
    s.sparks = s.sparks.filter((sp) => sp.life > 0);
    for (const pt of s.pops) {
      pt.y -= 35 * dt;
      pt.life -= dt;
    }
    s.pops = s.pops.filter((pt) => pt.life > 0);
    return;
  }

  // Bat swing decay
  if (s.batSwing > 0) {
    s.batSwing = Math.max(0, s.batSwing - dt * 2.5);
  }

  for (const sp of s.sparks) {
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    sp.vy += 180 * dt;
    sp.life -= dt;
  }
  s.sparks = s.sparks.filter((sp) => sp.life > 0);

  for (const pt of s.pops) {
    pt.y -= 35 * dt;
    pt.life -= dt;
  }
  s.pops = s.pops.filter((pt) => pt.life > 0);

  if (s.ball && s.ball.progress > 0.75) {
    s.gloveSpread = Math.max(0, s.gloveSpread - dt * 5);
  } else {
    s.gloveSpread = Math.min(1, s.gloveSpread + dt * 3);
  }

  if (s.ball && s.ball.active) {
    s.ball.progress += s.ball.speed * dt;

    if (!s.ball.bouncePlayed && s.ball.progress >= s.ball.bounceZ) {
      s.ball.bouncePlayed = true;
      playSound("bounce");
      const bp = ballPos(s.ball, w, h);
      addSparks(s, bp.x, bp.y + bp.r, "rgba(200,180,120,0.5)", 3);
    }

    // Batter swings as ball passes
    if (s.ball.progress >= 0.72 && s.batSwing === 0) {
      s.batSwing = 1;
    }

    if (s.ball.progress >= 1) {
      s.ball.active = false;
      s.totalBalls++;

      const bp = ballPos(s.ball, w, h);
      const gx = s.mx * w;
      const gy = s.my * h;
      const dist = Math.hypot(bp.x - gx, bp.y - gy);
      const catchR = Math.min(w * 0.055, 40);

      if (dist <= catchR) {
        s.catches++;
        s.catchesInLvl++;
        s.streak++;
        if (s.streak > s.bestStreak) s.bestStreak = s.streak;

        const pts = Math.round(
          (10 + Math.max(0, s.streak - 1) * 5) * (1 + (s.level - 1) * 0.5),
        );
        s.score += pts;

        addSparks(s, gx, gy, P.caught, 14);
        addSparks(s, gx, gy, P.gold, 6);
        addPop(s, `+${pts}`, gx, gy - 30, P.gold, 24);
        if (s.streak >= 3) {
          addPop(s, `${s.streak}x STREAK`, gx, gy - 55, P.cta, 18);
        }
        s.flash = { c: P.caught, a: 0.12 };
        s.gloveSpread = 0;
        playSound("catch");

        if (s.catchesInLvl >= CATCHES_PER_LEVEL) {
          s.level++;
          s.catchesInLvl = 0;
          s.overPause = 3.0;
          s.ball = null;
          s.gap = 1.2;
        }
      } else {
        s.lives--;
        s.streak = 0;

        addSparks(s, bp.x, bp.y, P.dropped, 10);
        s.flash = { c: P.dropped, a: 0.18 };
        s.shakeX = (Math.random() - 0.5) * 12;
        s.shakeY = (Math.random() - 0.5) * 8;
        playSound("drop");

        if (dist <= catchR * 1.6) {
          addPop(s, "SO CLOSE!", bp.x, bp.y - 25, P.dropped, 22);
        } else {
          addPop(s, "DROPPED!", bp.x, bp.y - 25, P.dropped, 22);
        }

        if (s.lives <= 0) {
          s.phase = "over";
          if (s.score > s.hi) {
            s.hi = s.score;
            try {
              localStorage.setItem("pmcc_keeper_hi", String(s.score));
            } catch {}
          }
          return;
        }
      }

      s.ball = null;
      s.gap = GAP_BETWEEN - Math.min(s.level * 0.06, 0.4);
    }
  } else if (!s.ball) {
    s.gap -= dt;
    if (s.gap <= 0) {
      s.ball = mkBall(s.level);
    }
  }
}

// ── React Component ─────────────────────────────────────────

export default function BeTheKeeper() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GS>(initState());
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const isLoggedInRef = useRef(false);
  const gameOverHandledRef = useRef(false);

  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;

  // Keep ref in sync
  useEffect(() => {
    isLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn]);

  const handleGameOver = useCallback(async (s: GS) => {
    // Fetch leaderboard (always)
    try {
      const result = await actions.leaderboard.get({ game: "be-the-keeper", limit: 5 });
      if (result.data) {
        s.leaderboard = result.data.entries;
      }
    } catch { /* leaderboard fetch failed silently */ }

    // Submit score if logged in
    if (isLoggedInRef.current && s.score > 0) {
      try {
        const result = await actions.gameScore.submitScore({
          game: "be-the-keeper",
          score: s.score,
          level: s.level,
          catches: s.catches,
          bestStreak: s.bestStreak,
        });
        if (result.data?.saved) {
          s.scoreSaved = true;
          // Re-fetch leaderboard to reflect new score
          const lb = await actions.leaderboard.get({ game: "be-the-keeper", limit: 5 });
          if (lb.data) {
            s.leaderboard = lb.data.entries;
          }
        }
      } catch { /* score submit failed silently */ }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lw = 0;
    let lh = 0;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      lw = rect.width;
      lh = rect.height;
      canvas!.width = lw * dpr;
      canvas!.height = lh * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    function onMouse(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const s = stateRef.current;
      s.mx = clamp((e.clientX - rect.left) / rect.width, 0.08, 0.92);
      s.my = clamp((e.clientY - rect.top) / rect.height, 0.5, 0.92);
    }

    function onTouch(e: TouchEvent) {
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      const rect = canvas!.getBoundingClientRect();
      const s = stateRef.current;
      s.mx = clamp((t.clientX - rect.left) / rect.width, 0.08, 0.92);
      s.my = clamp((t.clientY - rect.top) / rect.height, 0.5, 0.92);
      // Also handle tap-to-start on mobile (preventDefault blocks click)
      if (e.type === "touchstart") handleClick(e);
    }

    function handleClick(e: MouseEvent | TouchEvent) {
      const s = stateRef.current;

      if (s.phase === "over") {
        // Check sign-up link click
        const bounds = (s as GS & { _signUpBounds?: { x: number; y: number; w: number; h: number } })._signUpBounds;
        if (bounds && !isLoggedInRef.current) {
          const rect = canvas!.getBoundingClientRect();
          let cx: number, cy: number;
          if ("touches" in e && e.touches[0]) {
            cx = (e.touches[0].clientX - rect.left) / rect.width * lw;
            cy = (e.touches[0].clientY - rect.top) / rect.height * lh;
          } else if ("clientX" in e) {
            cx = (e.clientX - rect.left) / rect.width * lw;
            cy = (e.clientY - rect.top) / rect.height * lh;
          } else {
            cx = 0; cy = 0;
          }
          if (cx >= bounds.x && cx <= bounds.x + bounds.w && cy >= bounds.y && cy <= bounds.y + bounds.h) {
            window.location.href = "/auth/register";
            return;
          }
        }

        // Check leaderboard link click
        const lbBounds = (s as GS & { _lbLinkBounds?: { x: number; y: number; w: number; h: number } })._lbLinkBounds;
        if (lbBounds) {
          const rect = canvas!.getBoundingClientRect();
          let cx: number, cy: number;
          if ("touches" in e && e.touches[0]) {
            cx = (e.touches[0].clientX - rect.left) / rect.width * lw;
            cy = (e.touches[0].clientY - rect.top) / rect.height * lh;
          } else if ("clientX" in e) {
            cx = (e.clientX - rect.left) / rect.width * lw;
            cy = (e.clientY - rect.top) / rect.height * lh;
          } else {
            cx = 0; cy = 0;
          }
          if (cx >= lbBounds.x && cx <= lbBounds.x + lbBounds.w && cy >= lbBounds.y && cy <= lbBounds.y + lbBounds.h) {
            window.location.href = "/game/be-the-keeper/leaderboard";
            return;
          }
        }
      }

      // Start / restart game
      if (s.phase === "menu") {
        const hi = s.hi;
        Object.assign(s, initState());
        s.hi = hi;
        s.phase = "play";
        s.overPause = 3.0;
        s.gap = 1.2;
        gameOverHandledRef.current = false;
      } else if (s.phase === "over" && s.gameOverTime > 1.5) {
        const hi = s.hi;
        Object.assign(s, initState());
        s.hi = hi;
        s.phase = "play";
        s.overPause = 3.0;
        s.gap = 1.2;
        gameOverHandledRef.current = false;
      }
    }

    function loop(ts: number) {
      const dt = lastRef.current ? (ts - lastRef.current) / 1000 : 0.016;
      lastRef.current = ts;
      const s = stateRef.current;
      update(s, dt, lw, lh);
      drawScene(ctx!, s, lw, lh, isLoggedInRef.current);
      // Show cursor on menu/over, hide during play
      const wantCursor = s.phase !== "play";
      canvas!.style.cursor = wantCursor ? "pointer" : "none";

      // Trigger game-over handling once
      if (s.phase === "over" && !gameOverHandledRef.current) {
        gameOverHandledRef.current = true;
        handleGameOver(s);
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    canvas.addEventListener("mousemove", onMouse);
    canvas.addEventListener("touchmove", onTouch, { passive: false });
    canvas.addEventListener("touchstart", onTouch, { passive: false });
    canvas.addEventListener("click", handleClick);
    window.addEventListener("resize", resize);
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("mousemove", onMouse);
      canvas.removeEventListener("touchmove", onTouch);
      canvas.removeEventListener("touchstart", onTouch);
      canvas.removeEventListener("click", handleClick);
      window.removeEventListener("resize", resize);
    };
  }, [handleGameOver]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // On mobile landscape, expand canvas to fill viewport (no Fullscreen API needed — iOS doesn't support it)
  const expanded = isMobile && !isPortrait;

  useEffect(() => {
    const checkMobile = () => "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const checkOrientation = () => {
      const mobile = checkMobile();
      setIsMobile(mobile);
      setIsPortrait(mobile && window.innerHeight > window.innerWidth);
    };
    checkOrientation();

    window.addEventListener("resize", checkOrientation);
    const onOrientationChange = () => setTimeout(checkOrientation, 200);
    window.addEventListener("orientationchange", onOrientationChange);

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", onOrientationChange);
    };
  }, []);

  // Scroll to top of game when going landscape on mobile to maximize visible area
  useEffect(() => {
    if (expanded && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: "instant", block: "start" });
      // Hide address bar on mobile browsers
      window.scrollTo(0, 1);
    }
  }, [expanded]);

  return (
    <div
      ref={containerRef}
      style={{
        position: expanded ? "fixed" : "relative",
        inset: expanded ? 0 : undefined,
        width: expanded ? "100vw" : "100%",
        height: expanded ? "100vh" : undefined,
        maxWidth: expanded ? "none" : 900,
        margin: expanded ? 0 : "0 auto",
        background: expanded ? "#000" : undefined,
        zIndex: expanded ? 9999 : undefined,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: expanded ? "100%" : undefined,
          maxWidth: expanded ? "none" : 900,
          aspectRatio: expanded ? undefined : "16/10",
          display: "block",
          margin: "0 auto",
          cursor: "pointer",
          touchAction: "none",
          borderRadius: expanded ? 0 : 12,
          boxShadow: expanded ? "none" : "0 8px 32px rgba(0,0,0,0.25)",
          background: "#000",
        }}
      />
      {isMobile && isPortrait && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(27,61,47,0.95)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            zIndex: 20,
            gap: 16,
            padding: 24,
          }}
        >
          <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            fill="none"
            style={{ animation: "keeper-rotate 2s ease-in-out infinite" }}
          >
            <rect x="16" y="8" width="32" height="48" rx="4" stroke="#FEE140" strokeWidth="2.5" fill="none" />
            <circle cx="32" cy="50" r="2" fill="#FEE140" />
            <path d="M52 28 L58 22" stroke="#FEE140" strokeWidth="2" strokeLinecap="round" />
            <path d="M52 36 L58 42" stroke="#FEE140" strokeWidth="2" strokeLinecap="round" />
            <path d="M54 32 L60 32" stroke="#FEE140" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p style={{ color: "#fff", fontSize: 20, fontWeight: 700, textAlign: "center", margin: 0, fontFamily: "'Lora', serif" }}>
            Turn Your Phone to Landscape
          </p>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, textAlign: "center", margin: 0 }}>
            For the best experience
          </p>
          <style>{`
            @keyframes keeper-rotate {
              0%, 100% { transform: rotate(0deg); }
              25% { transform: rotate(90deg); }
              50%, 75% { transform: rotate(90deg); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
