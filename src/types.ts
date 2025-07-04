export type CookieSameSite = 'Strict' | 'Lax' | 'None';

export interface CookieInit {
	name: string;
	value?: string;
	domain?: string; // Defaults to '/'. To allow the browser to set the path, use an empty string.
	path?: string;
	expires?: number | Date | string;
	maxAge?: number;
	secure?: boolean; // Defaults to `lax`.
	sameSite?: CookieSameSite;
	httpOnly?: boolean;
	partitioned?: boolean;
}

export interface CookieRaw {
	name: string;
	value?: string;
	domain?: string; // Defaults to '/'. To allow the browser to set the path, use an empty string.
	path?: string;
	expires?: number;
	maxAge?: number;
	secure?: boolean; // Defaults to `lax`.
	sameSite?: CookieSameSite;
	httpOnly?: boolean;
	partitioned?: boolean;
}

export interface ParseResult {
	cookies: CookieRaw[];
	errors: string[]; // ошибки валидации
	stats: {
		total: number;
		valid: number;
		formats: Record<CookieFormat, number>; // счетчик по форматам
	};
}

export enum CookieFormat {
	SET_COOKIE = 'set-cookie',
	NETSCAPE = 'netscape',
	JSON = 'json',
}

export interface ValidationError {
	line: number;
	error: string;
	rawData: string;
}

export interface FormatDetectionResult {
	format: CookieFormat;
	confidence: number; // 0-1
	lines: string[];
}

export interface ParserConfig {
	chunk?: number;
	forceChunks?: boolean;
}
