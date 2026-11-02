/**
 * QRShield UPI and QR Payload Parser
 * Parses NPCI UPI URI specifications (upi://pay?...) and detects non-UPI web links / shortened URLs.
 */

export interface ParsedUpiPayload {
  raw: string;
  isUpi: boolean;
  isUrl: boolean;
  isShortenedUrl: boolean;
  pa?: string;
  pn?: string;
  am?: number;
  cu?: string;
  tn?: string;
  mc?: string;
  tr?: string;
  tid?: string;
  url?: string;
  username?: string;
  handle?: string;
  error?: string;
}

const SHORTENED_DOMAINS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'is.gd',
  'buff.ly',
  'ow.ly',
  'cutt.ly',
  'goo.gl',
  'rebrand.ly',
  'tiny.cc',
  'v.gd',
  'shorte.st',
]);

/**
 * Checks if a string is a standard web URL (http/https or www.).
 */
export function isWebUrl(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^www\.[a-z0-9-]+\.[a-z]{2,}/i.test(trimmed)) return true;
  return false;
}

/**
 * Checks if a URL points to a known link shortener service.
 */
export function isShortenedUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    let hostname = '';
    if (/^https?:\/\//i.test(url)) {
      hostname = new URL(url).hostname.toLowerCase();
    } else {
      const match = url.trim().match(/^([a-z0-9-]+\.[a-z]{2,})/i);
      if (match) hostname = match[1].toLowerCase();
    }
    hostname = hostname.replace(/^www\./, '');
    return SHORTENED_DOMAINS.has(hostname);
  } catch {
    return false;
  }
}

/**
 * Parses raw text extracted from a QR code.
 */
export function parseUpiPayload(raw: string): ParsedUpiPayload {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return {
      raw: raw || '',
      isUpi: false,
      isUrl: false,
      isShortenedUrl: false,
      error: 'Empty or blank QR payload.',
    };
  }

  const trimmed = raw.trim();

  // 1. Check if it's a UPI payment URI
  if (/^upi:\/\/pay/i.test(trimmed)) {
    try {
      const qIndex = trimmed.indexOf('?');
      if (qIndex === -1) {
        return {
          raw,
          isUpi: true,
          isUrl: false,
          isShortenedUrl: false,
          error: 'UPI payload is missing parameters.',
        };
      }

      const queryString = trimmed.slice(qIndex + 1);
      const params = new URLSearchParams(queryString);

      const pa = params.get('pa') ?? undefined;
      const pn = params.get('pn') ?? undefined;
      const amRaw = params.get('am') ?? undefined;
      const cu = params.get('cu') ?? undefined;
      const tn = params.get('tn') ?? undefined;
      const mc = params.get('mc') ?? undefined;
      const tr = params.get('tr') ?? undefined;
      const tid = params.get('tid') ?? undefined;
      const url = params.get('url') ?? undefined;

      let am: number | undefined = undefined;
      if (amRaw !== undefined) {
        const parsedAm = parseFloat(amRaw);
        if (!isNaN(parsedAm) && parsedAm >= 0) {
          am = parsedAm;
        }
      }

      let username: string | undefined = undefined;
      let handle: string | undefined = undefined;

      if (pa) {
        const atIndex = pa.indexOf('@');
        if (atIndex !== -1) {
          username = pa.slice(0, atIndex).toLowerCase();
          handle = pa.slice(atIndex + 1).toLowerCase();
        } else {
          username = pa.toLowerCase();
        }
      }

      return {
        raw,
        isUpi: true,
        isUrl: false,
        isShortenedUrl: false,
        pa,
        pn,
        am,
        cu,
        tn,
        mc,
        tr,
        tid,
        url,
        username,
        handle,
      };
    } catch (err) {
      return {
        raw,
        isUpi: true,
        isUrl: false,
        isShortenedUrl: false,
        error: err instanceof Error ? err.message : 'Failed to parse UPI payload parameters.',
      };
    }
  }

  // 2. Check if it's an external web URL or shortened URL
  const isUrl = isWebUrl(trimmed);
  const shortened = isUrl ? isShortenedUrl(trimmed) : false;

  return {
    raw,
    isUpi: false,
    isUrl,
    isShortenedUrl: shortened,
  };
}

