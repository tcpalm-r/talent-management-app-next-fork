import JSZip from 'jszip';

export type TranscriptFormat = 'teams' | 'leadr' | 'vtt' | 'srt' | 'json' | 'docx' | 'generic';

export interface ImportedTranscript {
  content: string;
  tags: string[];
  participants: string[];
  detectedFormat: TranscriptFormat;
  warnings: string[];
}

interface NormalizeOptions {
  hint?: string;
}

const SPEAKER_KEYS = ['speaker', 'name', 'role', 'participant'];
const TEXT_KEYS = ['text', 'content', 'utterance', 'message', 'note', 'transcript'];

export async function importTranscriptFromFile(file: File): Promise<ImportedTranscript> {
  const extension = (file.name.split('.').pop() || '').toLowerCase();
  const mimeGroup = file.type.split('/')[0];

  if (extension === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const text = await extractDocxText(arrayBuffer);
    return normalizeTranscriptText(text, { hint: 'docx' });
  }

  const rawText = await readFileAsText(file);

  if (extension === 'json' || file.type === 'application/json') {
    const parsed = extractTranscriptFromJson(rawText);
    if (parsed) {
      return {
        content: parsed.lines.join('\n'),
        tags: parsed.tags,
        participants: Array.from(parsed.participants),
        detectedFormat: 'json',
        warnings: parsed.warnings,
      };
    }
  }

  if (extension === 'vtt' || rawText.trim().startsWith('WEBVTT')) {
    return normalizeTranscriptText(rawText, { hint: 'vtt' });
  }

  if (extension === 'srt') {
    return normalizeTranscriptText(rawText, { hint: 'srt' });
  }

  if (extension === 'csv' || extension === 'tsv' || mimeGroup === 'text') {
    return normalizeTranscriptText(rawText, { hint: extension });
  }

  // Generic fallback – attempt to normalize any textual content.
  return normalizeTranscriptText(rawText);
}

export function normalizeTranscriptText(raw: string, options: NormalizeOptions = {}): ImportedTranscript {
  const cleaned = stripBom(raw).replace(/\u0000/g, '');
  const detectedFormat = detectFormat(cleaned, options.hint);

  switch (detectedFormat) {
    case 'teams':
      return parseTeamsTranscript(cleaned);
    case 'leadr':
      return parseLeadrTranscript(cleaned);
    case 'vtt':
    case 'srt':
      return parseCaptionTranscript(cleaned, detectedFormat);
    default:
      return parseGenericTranscript(cleaned, detectedFormat);
  }
}

async function extractDocxText(arrayBuffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) {
    throw new Error('Unable to locate document.xml inside DOCX archive.');
  }

  const xml = await documentFile.async('string');
  return xml
    .replace(/<w:p[^>]*>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
}

function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

function detectFormat(text: string, hint?: string): TranscriptFormat {
  if (hint === 'docx') return 'docx';
  if (hint === 'vtt' || /WEBVTT/i.test(text)) return 'vtt';
  if (hint === 'srt' || /-->/.test(text)) return 'srt';

  const hasTeamsMarkers = /\[(?:\d{1,2}:){1,2}\d{2}\]\s*[^:]+:/.test(text) || /Teams Meeting Transcript/i.test(text);
  if (hasTeamsMarkers) return 'teams';

  if (/Coach:/i.test(text) && /Direct Report:/i.test(text)) return 'leadr';

  if (hint === 'json') return 'json';

  return 'generic';
}

function parseTeamsTranscript(text: string): ImportedTranscript {
  const lines = normaliseLines(text);
  const participants = new Set<string>();
  const chunks: string[] = [];
  let currentSpeaker: string | null = null;
  let buffer: string[] = [];

  const speakerPatterns = [
    /^\s*\[(?<timestamp>(?:\d{1,2}:){1,2}\d{2})\]\s*(?<speaker>[^:]+):\s*(?<body>.*)$/,
    /^\s*(?<speaker>[^:]+?):\s*(?<body>.+)$/, // fallback "Speaker: body"
    /^\s*(?<speaker>[^-]+?)\s+-\s+(?<timestamp>(?:\d{1,2}:){1,2}\d{2})\s+-?\s*(?<body>.*)$/,
  ];

  const pushBuffer = () => {
    if (currentSpeaker) {
      const message = buffer.join(' ').trim();
      if (message) {
        chunks.push(`${currentSpeaker}: ${message}`);
      }
    } else {
      const stray = buffer.join(' ').trim();
      if (stray) chunks.push(stray);
    }
    buffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(line)) {
      // Standalone timestamp, skip.
      continue;
    }

    const match = speakerPatterns
      .map((pattern) => line.match(pattern))
      .find((result) => result && result.groups);

    if (match && match.groups) {
      pushBuffer();
      currentSpeaker = tidyName(match.groups.speaker);
      if (currentSpeaker) participants.add(currentSpeaker);
      const body = (match.groups.body || '').trim();
      buffer = body ? [body] : [];
      continue;
    }

    buffer.push(line);
  }

  pushBuffer();

  return {
    content: chunks.join('\n'),
    tags: ['format:teams'],
    participants: Array.from(participants),
    detectedFormat: 'teams',
    warnings: [],
  };
}

function parseLeadrTranscript(text: string): ImportedTranscript {
  const lines = normaliseLines(text);
  const participants = new Set<string>();
  const chunks: string[] = [];
  let currentSpeaker: string | null = null;
  let buffer: string[] = [];

  const pushBuffer = () => {
    const message = buffer.join(' ').trim();
    if (!message) return;
    const speakerLabel = currentSpeaker || 'Coach/DirectReport';
    chunks.push(`${speakerLabel}: ${message}`);
    if (currentSpeaker) participants.add(currentSpeaker);
    buffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const speakerMatch = line.match(/^(Coach|Leader|Manager|Direct Report|DirectReport|Employee)\s*:$/i);
    if (speakerMatch) {
      pushBuffer();
      currentSpeaker = tidyName(speakerMatch[1]);
      continue;
    }

    const inlineSpeaker = line.match(/^(Coach|Leader|Manager|Direct Report|Employee)\s*:\s*(.+)$/i);
    if (inlineSpeaker) {
      pushBuffer();
      currentSpeaker = tidyName(inlineSpeaker[1]);
      participants.add(currentSpeaker);
      buffer = [inlineSpeaker[2].trim()];
      continue;
    }

    if (/^[-•]/.test(line)) {
      buffer.push(line.replace(/^[-•]\s*/, ''));
      continue;
    }

    buffer.push(line);
  }

  pushBuffer();

  return {
    content: chunks.join('\n'),
    tags: ['format:leadr'],
    participants: Array.from(participants),
    detectedFormat: 'leadr',
    warnings: [],
  };
}

function parseCaptionTranscript(text: string, format: TranscriptFormat): ImportedTranscript {
  const lines = normaliseLines(text);
  const contentLines: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^WEBVTT/i.test(line)) continue;
    if (/^\d+$/.test(line)) continue;
    if (/-->/.test(line)) continue;
    contentLines.push(line);
  }

  const flattened = contentLines.join('\n');
  const normalized = parseGenericTranscript(flattened, format);
  normalized.detectedFormat = format;
  normalized.tags = Array.from(new Set([...normalized.tags, `format:${format}`]));
  return normalized;
}

function parseGenericTranscript(text: string, detectedFormat: TranscriptFormat): ImportedTranscript {
  const lines = normaliseLines(text);
  const participants = new Set<string>();
  const chunks: string[] = [];
  let currentSpeaker: string | null = null;
  let buffer: string[] = [];

  const pushBuffer = () => {
    const message = buffer.join(' ').trim();
    if (!message) return;
    if (currentSpeaker) {
      chunks.push(`${currentSpeaker}: ${message}`);
      participants.add(currentSpeaker);
    } else {
      chunks.push(message);
    }
    buffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex > 0 && colonIndex < 80) {
      const possibleSpeaker = line.slice(0, colonIndex).trim();
      const message = line.slice(colonIndex + 1).trim();

      if (possibleSpeaker.split(' ').length <= 6 && /[A-Za-z]/.test(possibleSpeaker)) {
        pushBuffer();
        currentSpeaker = tidyName(possibleSpeaker);
        buffer = message ? [message] : [];
        continue;
      }
    }

    if (/^[-•]/.test(line)) {
      buffer.push(line.replace(/^[-•]\s*/, ''));
      continue;
    }

    buffer.push(line);
  }

  pushBuffer();

  const tags = detectedFormat !== 'generic' ? [`format:${detectedFormat}`] : [];

  return {
    content: chunks.join('\n'),
    tags,
    participants: Array.from(participants),
    detectedFormat,
    warnings: [],
  };
}

function extractTranscriptFromJson(rawText: string) {
  try {
    const data = JSON.parse(rawText);
    const lines: string[] = [];
    const participants = new Set<string>();
    const warnings: string[] = [];

    const visit = (value: unknown) => {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const speaker = findFirstString(record, SPEAKER_KEYS);
        const text = findFirstString(record, TEXT_KEYS);

        if (speaker && text) {
          const cleanedSpeaker = tidyName(speaker);
          participants.add(cleanedSpeaker);
          lines.push(`${cleanedSpeaker}: ${cleanMultiline(text)}`);
          return;
        }

        Object.values(record).forEach(visit);
        return;
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          lines.push(cleanMultiline(trimmed));
        }
      }
    };

    visit(data);

    if (lines.length === 0) {
      warnings.push('No speaker/content pairs detected in JSON payload.');
    }

    return { lines, participants, tags: ['format:json'], warnings };
  } catch (error) {
    console.warn('Failed to parse transcript JSON', error);
    return null;
  }
}

function findFirstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (Array.isArray(value)) {
      const found = value.find((item) => typeof item === 'string' && item.trim());
      if (typeof found === 'string') return found.trim();
    }
  }
  return null;
}

function normaliseLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n');
}

function tidyName(name: string): string {
  return name.replace(/\s+/g, ' ').replace(/[\[\]\u200b]/g, '').trim();
}

function cleanMultiline(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
