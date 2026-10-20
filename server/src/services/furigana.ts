import KuroshiroModule from "kuroshiro";
import KuromojiAnalyzerModule from "kuroshiro-analyzer-kuromoji";
import { logger } from "$src/logger";

const log = logger.child({ module: "furigana" });

// Handle both ESM default and CommonJS module shapes
const Kuroshiro = (KuroshiroModule as any).default || KuroshiroModule;
const KuromojiAnalyzer = (KuromojiAnalyzerModule as any).default || KuromojiAnalyzerModule;

let kuroshiroInstancePromise: Promise<any> | null = null;

export async function getKuroshiro(): Promise<any> {
  if (!kuroshiroInstancePromise) {
    kuroshiroInstancePromise = (async () => {
      try {
        const ks = new Kuroshiro();
        await ks.init(new KuromojiAnalyzer());
        return ks;
      } catch (err) {
        kuroshiroInstancePromise = null;
        log.error({ err }, "Failed to initialize Kuroshiro with KuromojiAnalyzer");
        throw err;
      }
    })();
  }
  return kuroshiroInstancePromise;
}

/**
 * Converts ASS/SSA timestamp (H:MM:SS.cc) to WebVTT timestamp (HH:MM:SS.mmm).
 */
export function assTimeToVtt(timeStr: string): string {
  const parts = timeStr.trim().split(":");
  if (parts.length === 3) {
    let [h, m, s] = parts;
    h = h.padStart(2, "0");
    m = m.padStart(2, "0");
    const [sec, cs] = s.split(".");
    const ms = (cs || "0").padEnd(3, "0").slice(0, 3);
    return `${h}:${m}:${sec.padStart(2, "0")}.${ms}`;
  }
  return timeStr;
}

/**
 * Converts ASS or SSA subtitle text to standard WebVTT format.
 */
export function convertAssToVtt(assContent: string): string {
  const lines = assContent.split(/\r?\n/);
  const cues: string[] = [];
  let inEvents = false;
  let formatCols: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[Events]")) {
      inEvents = true;
      continue;
    }
    if (trimmed.startsWith("[") && inEvents) {
      break;
    }
    if (!inEvents) continue;

    if (trimmed.startsWith("Format:")) {
      formatCols = trimmed
        .replace(/^Format:\s*/, "")
        .split(",")
        .map((c) => c.trim().toLowerCase());
      continue;
    }

    if (trimmed.startsWith("Dialogue:")) {
      const rest = line.substring(line.indexOf(":") + 1);
      const colCount = formatCols.length > 0 ? formatCols.length : 10;
      const parts: string[] = [];
      let cur = "";
      let count = 0;
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === "," && count < colCount - 1) {
          parts.push(cur.trim());
          cur = "";
          count++;
        } else {
          cur += rest[i];
        }
      }
      parts.push(cur.trim());

      const startIdx = formatCols.indexOf("start");
      const endIdx = formatCols.indexOf("end");
      const textIdx = formatCols.indexOf("text");

      const start = startIdx >= 0 ? parts[startIdx] : parts[1];
      const end = endIdx >= 0 ? parts[endIdx] : parts[2];
      let text = textIdx >= 0 ? parts[textIdx] : parts[parts.length - 1];

      if (!start || !end || !text) continue;

      // Clean ASS formatting override tags: {\...}
      text = text.replace(/\{[^}]*\}/g, "");
      // Replace ASS line breaks
      text = text.replace(/\\N/g, "\n").replace(/\\n/g, "\n").replace(/\\h/g, " ");
      text = text.trim();
      if (!text) continue;

      cues.push(`${assTimeToVtt(start)} --> ${assTimeToVtt(end)}\n${text}`);
    }
  }

  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

/**
 * Converts SubRip (SRT) format to WebVTT format.
 */
export function convertSrtToVtt(srt: string): string {
  if (srt.trimStart().startsWith("WEBVTT")) {
    return srt;
  }
  const vttTimes = srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return `WEBVTT\n\n${vttTimes.trim()}\n`;
}

/**
 * In-memory cache for processed VTT tracks to prevent redundant conversions.
 */
export const subtitleCache = new Map<string, string>();
const MAX_CACHE_SIZE = 150;

export function getCachedSubtitle(key: string): string | undefined {
  return subtitleCache.get(key);
}

export function setCachedSubtitle(key: string, value: string): void {
  if (subtitleCache.size >= MAX_CACHE_SIZE) {
    const firstKey = subtitleCache.keys().next().value;
    if (firstKey) subtitleCache.delete(firstKey);
  }
  subtitleCache.set(key, value);
}

/**
 * Transforms Japanese WebVTT subtitles by adding HTML `<ruby>` furigana annotations.
 */
export async function addFuriganaToVtt(vttContent: string): Promise<string> {
  const ks = await getKuroshiro();
  const lines = vttContent.split(/\r?\n/);
  const result: string[] = [];
  let isCueText = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      isCueText = false;
      result.push(line);
      continue;
    }

    if (line.includes("-->")) {
      isCueText = true;
      result.push(line);
      continue;
    }

    if (!isCueText) {
      result.push(line);
      continue;
    }

    // Skip lines that already have ruby annotations
    if (line.includes("<ruby>")) {
      result.push(line);
      continue;
    }

    // Check if line contains any Kanji (Unicode range 4E00-9FFF)
    if (!/[\u4e00-\u9faf\u3400-\u4dbf]/.test(line)) {
      result.push(line);
      continue;
    }

    try {
      const converted = await ks.convert(line, { to: "hiragana", mode: "furigana" });
      // Strip <rp> tags for cleaner rendering and full media-captions compatibility
      const clean = converted.replace(/<rp>\(<\/rp>/g, "").replace(/<rp>\)<\/rp>/g, "");
      result.push(clean);
    } catch (err) {
      log.warn({ err, line }, "Failed to convert line to furigana");
      result.push(line);
    }
  }

  return result.join("\n");
}
