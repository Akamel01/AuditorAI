// Normalization for deterministic verbatim matching (verbatim-v1).
// Case- and accent-sensitive. See normalize contract.

export function normalizeForMatch(raw: string): string {
  return normalizeWithMap(raw).text;
}

export interface NormMap {
  text: string;
  normToRaw: number[];
}

export function normalizeWithMap(raw: string): NormMap {
  // Work in char arrays; map tracks raw index per output char.
  // Step (a): remove U+00AD, U+200B, U+200C, U+200D, U+FEFF.
  // Step (b): expand ligatures.
  // Step (c): fold quotes/dashes.
  // Step (d): de-hyphenate across line breaks (letter-letter only).
  // Step (e): collapse whitespace runs.

  // We build an intermediate string with a parallel raw-index array, then process.

  // First pass: remove + ligature + fold + dehyphenate detection needs raw adjacency.
  // Easier: operate on raw string char by char with lookahead.

  const removed = new Set([0x00ad, 0x200b, 0x200c, 0x200d, 0xfeff]);
  const ligature: Record<string, string> = {
    "\uFB00": "ff",
    "\uFB01": "fi",
    "\uFB02": "fl",
    "\uFB03": "ffi",
    "\uFB04": "ffl",
    "\uFB05": "st",
    "\uFB06": "st",
  };

  // Build step a-c output with raw index map.
  const chars: string[] = [];
  const rawIdx: number[] = [];
  const n = raw.length;
  for (let i = 0; i < n; i++) {
    const ch = raw[i];
    const code = ch.charCodeAt(0);
    if (removed.has(code)) continue;
    if (ligature[ch]) {
      const out = ligature[ch];
      for (let k = 0; k < out.length; k++) {
        chars.push(out[k]);
        rawIdx.push(i);
      }
      continue;
    }
    let c = ch;
    if (c === "\u201C" || c === "\u201D") c = '"';
    else if (c === "\u2018" || c === "\u2019") c = "'";
    else if (c === "\u2013" || c === "\u2014" || c === "\u2010" || c === "\u2011") c = "-";
    chars.push(c);
    rawIdx.push(i);
  }

  // Step (d): de-hyphenate: remove '-' + line break when letter before '-' and letter after break.
  // We scan the chars array for pattern: letter, '-', linebreak, letter. Remove the '-' and the linebreak.
  // Need to handle \r\n, \r, \n as line break.
  const isLetter = (s: string) => /^\p{L}$/u.test(s);
  const isBreak = (s: string) => s === "\r" || s === "\n";

  // Build result of dehyphenation.
  const outChars: string[] = [];
  const outRaw: number[] = [];
  let i = 0;
  const len = chars.length;
  while (i < len) {
    // check dehyphenate at i: chars[i] letter, chars[i+1]=='-', then linebreak, then letter
    if (
      i + 3 < len &&
      isLetter(chars[i]) &&
      chars[i + 1] === "-" &&
      isBreak(chars[i + 2]) &&
      isLetter(chars[i + 3])
    ) {
      // drop '-' and break; keep letter i; advance past break
      outChars.push(chars[i]);
      outRaw.push(rawIdx[i]);
      i += 3; // skip '-', break; next iteration handles letter at i+3? Wait we skipped to index of letter after break? 
      // We consumed indices i (letter), i+1 (-), i+2 (break). Next should process i+3 (letter). Set i=i+3? loop i++? We're in while with manual. Set i = i+3 then continue without i++? Let's set i += 3 and continue (then no extra). But then next iteration i points at letter after break (i+3). Good. But we already pushed letter i. Need skip the break's following? We set i to i+3 which is index of following letter; loop will process it. Good.
      continue;
    }
    // Also handle \r\n as two-char break? The spec says line break is \r\n|\r|\n. In our chars, \r and \n are separate chars (not removed yet). Pattern with \r\n would be letter, '-', \r, \n, letter = 5 chars. Handle.
    if (
      i + 4 < len &&
      isLetter(chars[i]) &&
      chars[i + 1] === "-" &&
      chars[i + 2] === "\r" &&
      chars[i + 3] === "\n" &&
      isLetter(chars[i + 4])
    ) {
      outChars.push(chars[i]);
      outRaw.push(rawIdx[i]);
      i += 4; // skip -, \r, \n ; next process letter at i+4? i now i+4? Let's compute: consumed i..i+3, next letter index i+4. Set i = i+4 then continue -> next iteration i=i+4 processes letter. Good.
      continue;
    }
    outChars.push(chars[i]);
    outRaw.push(rawIdx[i]);
    i++;
  }

  // Step (e): collapse whitespace runs.
  // \s in JS includes many; use regex \s
  const isWs = (s: string) => /\s/.test(s) || s === "\u00A0";

  const finalChars: string[] = [];
  const finalRaw: number[] = [];
  let j = 0;
  const m = outChars.length;
  while (j < m) {
    if (isWs(outChars[j])) {
      // collapse run
      finalChars.push(" ");
      finalRaw.push(outRaw[j]);
      while (j < m && isWs(outChars[j])) j++;
    } else {
      finalChars.push(outChars[j]);
      finalRaw.push(outRaw[j]);
      j++;
    }
  }
  // trim
  while (finalChars.length && finalChars[0] === " ") {
    finalChars.shift();
    finalRaw.shift();
  }
  while (finalChars.length && finalChars[finalChars.length - 1] === " ") {
    finalChars.pop();
    finalRaw.pop();
  }

  return { text: finalChars.join(""), normToRaw: finalRaw };
}

export function countWords(s: string): number {
  const tokens = s.split(/\s+/).filter((t) => t.length > 0);
  let n = 0;
  for (const t of tokens) {
    if (/\p{L}|\p{N}/u.test(t)) n++;
  }
  return n;
}
