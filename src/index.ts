// Main exports
export { CookieParser } from './parser';
export { CookieParser as default } from './parser';

// Types
export type { CookieInit, CookieRaw, CookieSameSite, ParseResult, ValidationError, FormatDetectionResult, ParserConfig } from './types';

export { CookieFormat } from './types';

// Individual components (for advanced usage)
export { FileExtractor } from './file-extractor';
export { NetscapeParser } from './parsers/netscape-parser';
export { SetCookieParser } from './parsers/setcookie-parser';
export { JsonParser } from './parsers/json-parser';
export { CookieValidator } from './cookie-validator';
export { CookieFormatDetector } from './format-detector';
export { CookieJar } from './cookiejar';
export { Cookie } from './cookie';

// Quick usage example
/**
 * @example
 * ```typescript
 * import { CookieParser } from 'cookie-parser';
 *
 * const content = `sessionid=abc123; Domain=example.com; Path=/; Secure`;
 * const parsed = CookieParser.parse(content);
 *
 * console.log(`Found ${parsed.cookies.length} valid cookies`);
 * console.log('Cookies:', parsed.cookies);
 * ```
 */
