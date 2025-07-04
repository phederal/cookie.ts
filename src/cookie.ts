import type { CookieInit, CookieSameSite } from './types';
import { CookieParser } from './parser';

/**
 * A class for working with a single cookie
 *
 * @example
 * ```js
 * const cookie = new Cookie("name", "value");
 * console.log(cookie.toString()); // "name=value; Path=/; SameSite=Lax"
 * ```
 * @example
 * ```js
 * const cookie = new Cookie("name=value; Domain=example.com; Path=/; Secure; HttpOnly");
 * console.log(cookie.toString()); // "name=value; Domain=example.com; Path=/; Secure; HttpOnly"
 * ```
 * @example
 * ```js
 * const cookie = new Cookie({  name: "name", value: "value", domain: "example.com", path: "/", secure: true, httpOnly: true });
 * console.log(cookie.toString()); // "name=value; Domain=example.com; Path=/; Secure; HttpOnly"
 * ```
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/cookie
 * @returns {Cookie}
 */
export class Cookie {
	/**
	 * The name of the cookie
	 */
	readonly name: string;

	/**
	 * The value of the cookie
	 */
	value?: string;

	/**
	 * The domain of the cookie
	 */
	domain?: string;

	/**
	 * The path of the cookie
	 */
	path: string = '/';

	/**
	 * The expiration date of the cookie
	 */
	expires?: number | Date | string;

	/**
	 * Whether the cookie is secure
	 */
	secure: boolean = false;

	/**
	 * The same-site attribute of the cookie
	 */
	sameSite: CookieSameSite = 'Lax';

	/**
	 * Whether the cookie is partitioned
	 */
	partitioned: boolean = false;

	/**
	 * The maximum age of the cookie in seconds
	 */
	maxAge?: number;

	/**
	 * Whether the cookie is HTTP-only
	 */
	httpOnly: boolean = false;

	constructor(name: string, value: string, options?: CookieInit);
	constructor(cookieString: string);
	constructor(cookieObject?: CookieInit);
	constructor(nameOrStringOrObject?: string | CookieInit, value?: string, options?: CookieInit) {
		// new Cookie(name, value, options?)
		if (typeof nameOrStringOrObject === 'string' && value !== undefined) {
			const name = nameOrStringOrObject;
			this.name = name;
			this.value = value;
			if (options) this.applyOptions(options);
		}

		// new Cookie(cookieString)
		else if (typeof nameOrStringOrObject === 'string' && value === undefined) {
			const cookieString = nameOrStringOrObject;
			const parsed = Cookie.parse(cookieString);
			this.name = parsed.name;
			this.value = parsed.value;
			// Копируем все свойства кроме name (readonly)
			this.domain = parsed.domain;
			this.path = parsed.path;
			this.expires = parsed.expires;
			this.maxAge = parsed.maxAge;
			this.secure = parsed.secure;
			this.httpOnly = parsed.httpOnly;
			this.sameSite = parsed.sameSite;
			this.partitioned = parsed.partitioned;
		}

		// new Cookie(cookieObject)
		else if (typeof nameOrStringOrObject === 'object' && nameOrStringOrObject !== null) {
			const cookieObject = nameOrStringOrObject;
			if (!cookieObject.name || !cookieObject.value) {
				throw new Error('Cookie object must have name and value properties');
			}
			this.name = cookieObject.name;
			this.value = cookieObject.value;
			this.applyOptions(cookieObject);
		}

		// new Cookie()
		else {
			this.name = '';
			this.value = '';
		}
	}

	private applyOptions(options: CookieInit): void {
		if (options.domain !== undefined) this.domain = options.domain;
		if (options.path !== undefined) this.path = options.path;
		if (options.expires !== undefined) this.expires = options.expires;
		if (options.maxAge !== undefined) this.maxAge = options.maxAge;
		if (options.secure !== undefined) this.secure = options.secure;
		if (options.httpOnly !== undefined) this.httpOnly = options.httpOnly;
		if (options.sameSite !== undefined) this.sameSite = options.sameSite;
	}

	/**
	 * Whether the cookie is expired
	 * @returns {boolean}
	 */
	isExpired(): boolean {
		if (!this.expires) return false;
		let expirationDate: Date;
		if (typeof this.expires === 'number') {
			expirationDate = new Date(this.expires * 1000); // unix timestamp to Date
		} else if (typeof this.expires === 'string') {
			expirationDate = new Date(this.expires); // string to Date
		} else {
			expirationDate = this.expires; // already Date
		}
		return new Date() > expirationDate;
	}

	/**
	 * Serialize the cookie to a Set-Cookie format
	 * @returns {string}
	 */
	toSetCookie(): string {
		let result = `${this.name}=${this.value}`;
		if (this.domain) result += `; Domain=${this.domain}`;
		if (this.path) result += `; Path=${this.path}`;
		if (this.expires) {
			let expirationDate: Date;
			if (typeof this.expires === 'number') {
				expirationDate = new Date(this.expires * 1000); // unix timestamp to Date
			} else if (typeof this.expires === 'string') {
				expirationDate = new Date(this.expires); // string to Date
			} else {
				expirationDate = this.expires; // already Date
			}
			result += `; Expires=${expirationDate.toUTCString()}`;
		}
		if (this.maxAge !== undefined) result += `; Max-Age=${this.maxAge}`;
		if (this.secure) result += '; Secure';
		if (this.httpOnly) result += '; HttpOnly';
		if (this.sameSite) result += `; SameSite=${this.sameSite}`;
		if (this.partitioned) result += '; Partitioned';
		return result;
	}

	/**
	 * Serialize the cookie to Netscape format
	 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie
	 * @returns {string}
	 */
	toNetscape(): string {
		// Автоматически определяем includeSubdomains по domain
		const includeSubdomains = this.domain?.startsWith('.') ? 'TRUE' : 'FALSE';

		// Убираем точку из domain для Netscape формата
		const cleanDomain = this.domain?.startsWith('.') ? this.domain.substring(1) : this.domain || '';

		const path = this.path || '/';
		const secure = this.secure ? 'TRUE' : 'FALSE';

		// Обрабатываем expires - может быть number, Date или string
		let expiresValue = '0';
		if (this.expires) {
			if (typeof this.expires === 'number') {
				expiresValue = this.expires.toString(); // unix timestamp как есть
			} else if (typeof this.expires === 'string') {
				const dateFromString = new Date(this.expires);
				expiresValue = Math.floor(dateFromString.getTime() / 1000).toString(); // string → unix
			} else {
				expiresValue = Math.floor(this.expires.getTime() / 1000).toString(); // Date → unix
			}
		}

		const prefix = this.httpOnly ? '#HttpOnly_' : '';

		return `${prefix}${cleanDomain}\t${includeSubdomains}\t${path}\t${secure}\t${expiresValue}\t${this.name}\t${this.value}`;
	}

	/**
	 * Serialize the cookie to a JSON object
	 * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/cookie
	 * @returns {CookieInit}
	 */
	toJSON(): CookieInit {
		const result: CookieInit = {
			name: this.name,
			value: this.value,
			path: this.path,
			secure: this.secure,
			httpOnly: this.httpOnly,
			sameSite: this.sameSite,
		};

		if (this.domain) result.domain = this.domain;
		if (this.maxAge !== undefined) result.maxAge = this.maxAge;

		// Обрабатываем expires - может быть number, Date или string
		if (this.expires) {
			if (typeof this.expires === 'number') {
				result.expires = this.expires; // unix timestamp как есть
			} else if (typeof this.expires === 'string') {
				const dateFromString = new Date(this.expires);
				result.expires = Math.floor(dateFromString.getTime() / 1000); // string → unix
			} else {
				result.expires = Math.floor(this.expires.getTime() / 1000); // Date → unix
			}
		}

		return result;
	}

	/**
	 * Serialize the cookie to a Set-Cookie string
	 * @returns {string}
	 */
	serialize(): string {
		return this.toSetCookie();
	}

	/**
	 * Serialize the cookie to a JSON string
	 * @returns {string}
	 */
	stringify(): string {
		return JSON.stringify(this.toJSON());
	}

	/**
	 * Parse a cookie string into a Cookie object
	 * @param cookieString - The cookie string (Set-Cookie, Netscape, or JSON)
	 * @returns {Cookie}
	 */
	static parse(cookieString: string): Cookie {
		try {
			// Пытаемся распарсить через наш парсер
			const parseResult = CookieParser.parse(cookieString.trim());
			if (parseResult.cookies.length === 0) {
				throw new Error('No valid cookies found in string');
			}
			// Берем первый найденный cookie
			const cookieInit = parseResult.cookies[0];
			return new Cookie(cookieInit);
		} catch (error) {
			throw new Error(`Failed to parse cookie string: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Create a new cookie from a name and value and optional options
	 * @param name - The name of the cookie
	 * @param value - The value of the cookie
	 * @param options - Optional options
	 * @returns {Cookie}
	 */
	static from(name: string, value: string, options?: CookieInit): Cookie {
		return new Cookie(name, value, options);
	}
}
