const TITLE_WORDS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "miss",
  "master",
  "rev",
  "sir",
  "prof",
]);

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.]/g, "")
    .split(/\s+/)
    .filter((w) => !TITLE_WORDS.has(w))
    .join(" ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from<number[], [number]>({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

/**
 * Compute a similarity score between two names (0 to 1).
 * Handles common variations: title prefixes, case, initials,
 * middle names, abbreviations, and small typos.
 */
export function nameSimilarity(nameA: string, nameB: string): number {
  const a = normalizeName(nameA);
  const b = normalizeName(nameB);

  if (a === b) return 1.0;
  if (!a || !b) return 0;

  const tokensA = a.split(" ");
  const tokensB = b.split(" ");

  // Sorted token match (handles reordered names: "Smith John" vs "John Smith")
  if ([...tokensA].sort().join(" ") === [...tokensB].sort().join(" "))
    return 0.95;

  // Surname (last token) based matching
  const surnameA = tokensA[tokensA.length - 1];
  const surnameB = tokensB[tokensB.length - 1];

  if (surnameA === surnameB && tokensA.length >= 1 && tokensB.length >= 1) {
    const firstA = tokensA[0];
    const firstB = tokensB[0];

    // Initial match: "J Smith" vs "John Smith"
    if (firstA.length === 1 || firstB.length === 1) {
      if (firstA.startsWith(firstB.charAt(0)) || firstB.startsWith(firstA.charAt(0))) return 0.8;
      return 0.3;
    }

    // Extra middle name/initial: "John Smith" vs "John P Smith"
    const shorter = tokensA.length <= tokensB.length ? tokensA : tokensB;
    const longer = tokensA.length <= tokensB.length ? tokensB : tokensA;
    if (shorter.length >= 2 && longer.length === shorter.length + 1) {
      const shorterFirst = shorter[0];
      const shorterLast = shorter[shorter.length - 1];
      const longerFirst = longer[0];
      const longerLast = longer[longer.length - 1];
      if (shorterFirst === longerFirst && shorterLast === longerLast) return 0.85;
    }

    // Prefix match: "Alex" vs "Alexander"
    if (
      firstA.length >= 3 &&
      firstB.length >= 3 &&
      (firstA.startsWith(firstB) || firstB.startsWith(firstA))
    )
      return 0.8;

    // Levenshtein on first name (catch small typos)
    const dist = levenshtein(firstA, firstB);
    const maxLen = Math.max(firstA.length, firstB.length);
    const sim = 1 - dist / maxLen;
    if (sim >= 0.7) return 0.5 + sim * 0.3;
  }

  // Full string Levenshtein similarity (very similar overall strings)
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  const fullSim = 1 - dist / maxLen;

  return fullSim >= 0.85 ? fullSim * 0.7 : 0;
}

/** Simple union-find for grouping member IDs. */
export class UnionFind {
  private parent = new Map<string, string>();
  private rankMap = new Map<string, number>();

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rankMap.set(x, 0);
    }
    const p = this.parent.get(x) ?? x;
    if (p !== x) {
      const root = this.find(p);
      this.parent.set(x, root);
      return root;
    }
    return p;
  }

  union(x: string, y: string): void {
    const px = this.find(x);
    const py = this.find(y);
    if (px === py) return;

    const rx = this.rankMap.get(px) ?? 0;
    const ry = this.rankMap.get(py) ?? 0;

    if (rx < ry) this.parent.set(px, py);
    else if (rx > ry) this.parent.set(py, px);
    else {
      this.parent.set(py, px);
      this.rankMap.set(px, rx + 1);
    }
  }

  connected(x: string, y: string): boolean {
    return this.find(x) === this.find(y);
  }

  /** Return all groups that have more than one member. */
  groups(ids: string[]): string[][] {
    const clusters = new Map<string, string[]>();
    for (const id of ids) {
      const root = this.find(id);
      const arr = clusters.get(root) ?? [];
      arr.push(id);
      clusters.set(root, arr);
    }
    return [...clusters.values()].filter((g) => g.length > 1);
  }
}
