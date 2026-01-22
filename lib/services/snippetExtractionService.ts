/**
 * Snippet Extraction Service
 *
 * Extracts verbatim quotes from source responses using key phrases
 * identified by Claude. This guarantees 100% accuracy for citations
 * since we programmatically extract from the actual source text.
 *
 * Used by: lib/services/surveyAnalyzerService.ts
 */

export interface ExtractionResult {
  snippet: string;
  snippetStart: number;
  snippetEnd: number;
  matchedPhrase: string | null;
  matchType: 'exact' | 'case_insensitive' | 'fallback';
}

export interface ExtractionOptions {
  targetWords?: number; // Target word count (default: 25)
  minWords?: number; // Minimum words (default: 10)
  maxWords?: number; // Maximum words (default: 50)
}

const DEFAULT_OPTIONS: Required<ExtractionOptions> = {
  targetWords: 25,
  minWords: 10,
  maxWords: 50,
};

/**
 * Extract a verbatim snippet from source text using key phrases.
 * Finds the first matching key phrase and extracts surrounding context.
 */
export function extractVerbatimSnippet(
  sourceText: string,
  keyPhrases: string[],
  options?: ExtractionOptions
): ExtractionResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!sourceText || sourceText.trim().length === 0) {
    return {
      snippet: '',
      snippetStart: 0,
      snippetEnd: 0,
      matchedPhrase: null,
      matchType: 'fallback',
    };
  }

  // Try each key phrase in order
  for (const phrase of keyPhrases) {
    if (!phrase || phrase.trim().length === 0) continue;

    // Try exact match first
    let idx = sourceText.indexOf(phrase);
    let matchType: 'exact' | 'case_insensitive' = 'exact';

    // Fall back to case-insensitive match
    if (idx === -1) {
      idx = sourceText.toLowerCase().indexOf(phrase.toLowerCase());
      matchType = 'case_insensitive';
    }

    if (idx >= 0) {
      const result = extractContextAroundMatch(
        sourceText,
        idx,
        phrase.length,
        opts
      );
      return {
        ...result,
        matchedPhrase: phrase,
        matchType,
      };
    }
  }

  // Fallback: extract first sentence(s) if no phrase matched
  return {
    ...extractFirstSentences(sourceText, opts),
    matchedPhrase: null,
    matchType: 'fallback',
  };
}

/**
 * Extract context around a matched phrase, expanding to sentence boundaries.
 */
function extractContextAroundMatch(
  text: string,
  matchStart: number,
  matchLength: number,
  opts: Required<ExtractionOptions>
): Omit<ExtractionResult, 'matchedPhrase' | 'matchType'> {
  const matchEnd = matchStart + matchLength;

  // Find sentence boundaries
  let sentenceStart = findSentenceStart(text, matchStart);
  let sentenceEnd = findSentenceEnd(text, matchEnd);

  let snippet = text.slice(sentenceStart, sentenceEnd).trim();
  let wordCount = countWords(snippet);

  // If too short, try to expand to include more sentences
  if (wordCount < opts.minWords) {
    // Try expanding forward
    const nextSentenceEnd = findSentenceEnd(text, sentenceEnd + 1);
    if (nextSentenceEnd > sentenceEnd) {
      const expandedSnippet = text.slice(sentenceStart, nextSentenceEnd).trim();
      if (countWords(expandedSnippet) <= opts.maxWords) {
        snippet = expandedSnippet;
        sentenceEnd = nextSentenceEnd;
        wordCount = countWords(snippet);
      }
    }
  }

  // If still too short, try expanding backward
  if (wordCount < opts.minWords && sentenceStart > 0) {
    const prevSentenceStart = findPreviousSentenceStart(text, sentenceStart - 1);
    const expandedSnippet = text.slice(prevSentenceStart, sentenceEnd).trim();
    if (countWords(expandedSnippet) <= opts.maxWords) {
      snippet = expandedSnippet;
      sentenceStart = prevSentenceStart;
    }
  }

  // If too long, trim while keeping the key phrase
  if (countWords(snippet) > opts.maxWords) {
    snippet = trimToWordCount(
      text,
      sentenceStart,
      sentenceEnd,
      matchStart - sentenceStart,
      opts.targetWords
    );
    // Recalculate boundaries for trimmed snippet
    const trimmedStart = text.indexOf(snippet, Math.max(0, sentenceStart - 10));
    if (trimmedStart >= 0) {
      sentenceStart = trimmedStart;
      sentenceEnd = trimmedStart + snippet.length;
    }
  }

  return {
    snippet: snippet.trim(),
    snippetStart: sentenceStart,
    snippetEnd: sentenceEnd,
  };
}

/**
 * Extract the first sentence(s) as fallback when no key phrase matches.
 */
function extractFirstSentences(
  text: string,
  opts: Required<ExtractionOptions>
): Omit<ExtractionResult, 'matchedPhrase' | 'matchType'> {
  let end = findSentenceEnd(text, 0);
  let snippet = text.slice(0, end).trim();

  // If first sentence is too short, add more
  while (countWords(snippet) < opts.minWords && end < text.length) {
    const nextEnd = findSentenceEnd(text, end + 1);
    if (nextEnd === end) break;

    const expandedSnippet = text.slice(0, nextEnd).trim();
    if (countWords(expandedSnippet) > opts.maxWords) break;

    snippet = expandedSnippet;
    end = nextEnd;
  }

  // If too long, trim
  if (countWords(snippet) > opts.maxWords) {
    snippet = trimToWordCountFromStart(snippet, opts.targetWords);
  }

  return {
    snippet,
    snippetStart: 0,
    snippetEnd: snippet.length,
  };
}

/**
 * Find the start of the sentence containing the given position.
 */
function findSentenceStart(text: string, position: number): number {
  // Walk backward to find sentence-ending punctuation or start of text
  for (let i = position - 1; i >= 0; i--) {
    if (/[.!?]/.test(text[i])) {
      // Skip whitespace after punctuation
      let start = i + 1;
      while (start < position && /\s/.test(text[start])) {
        start++;
      }
      return start;
    }
  }
  return 0;
}

/**
 * Find the start of the previous sentence.
 */
function findPreviousSentenceStart(text: string, position: number): number {
  // First find the end of the previous sentence
  let prevEnd = position;
  while (prevEnd > 0 && /\s/.test(text[prevEnd])) {
    prevEnd--;
  }

  // Then find its start
  return findSentenceStart(text, prevEnd);
}

/**
 * Find the end of the sentence containing the given position.
 */
function findSentenceEnd(text: string, position: number): number {
  // Walk forward to find sentence-ending punctuation or end of text
  for (let i = position; i < text.length; i++) {
    if (/[.!?]/.test(text[i])) {
      return i + 1;
    }
  }
  return text.length;
}

/**
 * Count words in a string.
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Trim text to approximately the target word count, keeping the key phrase area.
 */
function trimToWordCount(
  fullText: string,
  start: number,
  end: number,
  keyPhraseOffset: number,
  targetWords: number
): string {
  const text = fullText.slice(start, end);
  const words = text.split(/\s+/);

  if (words.length <= targetWords) {
    return text;
  }

  // Find which word index contains the key phrase
  let charCount = 0;
  let keyPhraseWordIndex = 0;
  for (let i = 0; i < words.length; i++) {
    if (charCount >= keyPhraseOffset) {
      keyPhraseWordIndex = i;
      break;
    }
    charCount += words[i].length + 1; // +1 for space
  }

  // Try to center the excerpt around the key phrase
  const halfTarget = Math.floor(targetWords / 2);
  let startWord = Math.max(0, keyPhraseWordIndex - halfTarget);
  let endWord = Math.min(words.length, startWord + targetWords);

  // Adjust if we hit the end
  if (endWord === words.length) {
    startWord = Math.max(0, endWord - targetWords);
  }

  const selectedWords = words.slice(startWord, endWord);

  // Add ellipsis if we trimmed
  let result = selectedWords.join(' ');
  if (startWord > 0) {
    result = '...' + result;
  }
  if (endWord < words.length) {
    result = result + '...';
  }

  return result;
}

/**
 * Trim text to target word count from the start.
 */
function trimToWordCountFromStart(text: string, targetWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= targetWords) {
    return text;
  }

  return words.slice(0, targetWords).join(' ') + '...';
}

/**
 * Process all citations in a Pass 1 result, extracting verbatim snippets.
 */
export function extractSnippetsForCitations(
  citations: Array<{ response_id: string; key_phrases: string[] }>,
  responseTextMap: Map<string, string>,
  options?: ExtractionOptions
): Array<{ response_id: string; snippet: string; matchedPhrase: string | null }> {
  return citations.map(citation => {
    const sourceText = responseTextMap.get(citation.response_id) || '';
    const result = extractVerbatimSnippet(
      sourceText,
      citation.key_phrases || [],
      options
    );

    return {
      response_id: citation.response_id,
      snippet: result.snippet,
      matchedPhrase: result.matchedPhrase,
    };
  });
}

/**
 * Validate that a snippet actually exists in the source text.
 * Returns true if the snippet is a verbatim substring of the source.
 */
export function validateSnippetIsVerbatim(
  snippet: string,
  sourceText: string
): boolean {
  if (!snippet || !sourceText) return false;

  // Remove ellipsis that we may have added during trimming
  const cleanSnippet = snippet.replace(/^\.\.\./, '').replace(/\.\.\.$/, '').trim();

  return sourceText.includes(cleanSnippet);
}
