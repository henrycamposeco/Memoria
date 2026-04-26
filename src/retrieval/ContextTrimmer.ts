import { getEncoding } from 'js-tiktoken';
import { SearchResult } from './HybridSearch.js';

export class ContextTrimmer {
  private encoder: any;

  constructor() {
    // Default to cl100k_base (used by GPT-4/3.5)
    this.encoder = getEncoding('cl100k_base');
  }

  countTokens(text: string): number {
    return this.encoder.encode(text).length;
  }

  trim(results: SearchResult[], maxTokens: number): SearchResult[] {
    let currentTokens = 0;
    const trimmedResults: SearchResult[] = [];

    // Prioritize by score (already sorted by HybridSearch)
    for (const res of results) {
      const header = `### ${res.title} (${res.type})\n`;
      const content = res.content + '\n\n';
      const itemTokens = this.countTokens(header + content);

      if (currentTokens + itemTokens <= maxTokens) {
        trimmedResults.push(res);
        currentTokens += itemTokens;
      } else {
        // If we can't fit the whole thing, check if we can fit a truncated version
        // Minimum usefulness: 50 tokens
        const remainingTokens = maxTokens - currentTokens;
        const headerTokens = this.countTokens(header);
        
        if (remainingTokens > headerTokens + 50) {
          const availableForContent = remainingTokens - headerTokens - 10; // buffer
          const truncatedContent = this.truncateByTokens(res.content, availableForContent);
          
          trimmedResults.push({
            ...res,
            content: truncatedContent + '\n[Truncated due to token limit]'
          });
          break; // Stop after one truncated entry
        }
        break;
      }
    }

    return trimmedResults;
  }

  private truncateByTokens(text: string, maxTokens: number): string {
    const tokens = this.encoder.encode(text);
    if (tokens.length <= maxTokens) return text;
    
    const truncatedTokens = tokens.slice(0, maxTokens);
    return this.encoder.decode(truncatedTokens);
  }

  formatResults(results: SearchResult[]): string {
    return results.map(res => {
      return `### ${res.title} (${res.type})\n${res.content}`;
    }).join('\n\n');
  }
}
