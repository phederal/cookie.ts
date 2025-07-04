import type { CookieRaw } from './types';
import type { ValidationError } from './types';

export class CookieValidator {
	static validate(cookie: Partial<CookieRaw>, lineNumber: number, rawData: string): ValidationError[] {
		const errors: ValidationError[] = [];

		// Проверяем обязательные поля
		if (!cookie.name || typeof cookie.name !== 'string') {
			errors.push({
				line: lineNumber,
				error: 'Cookie name is required and must be a string',
				rawData,
			});
		} else if (!this.isValidCookieName(cookie.name)) {
			errors.push({
				line: lineNumber,
				error: `Invalid cookie name: "${cookie.name}". Must not contain =, ;, or whitespace at edges`,
				rawData,
			});
		}

		if (cookie.value === undefined || cookie.value === null) {
			errors.push({
				line: lineNumber,
				error: 'Cookie value is required',
				rawData,
			});
		} else if (!this.isValidCookieValue(cookie.value)) {
			errors.push({
				line: lineNumber,
				error: `Invalid cookie value: contains prohibited characters`,
				rawData,
			});
		}

		if (!cookie.domain || typeof cookie.domain !== 'string') {
			errors.push({
				line: lineNumber,
				error: 'Cookie domain is required and must be a string',
				rawData,
			});
		} else if (!this.isValidDomain(cookie.domain)) {
			errors.push({
				line: lineNumber,
				error: `Invalid domain: "${cookie.domain}"`,
				rawData,
			});
		}

		// Проверяем необязательные поля
		if (cookie.path !== undefined && !this.isValidPath(cookie.path)) {
			errors.push({
				line: lineNumber,
				error: `Invalid path: "${cookie.path}"`,
				rawData,
			});
		}

		if (cookie.expires !== undefined && !this.isValidTimestamp(cookie.expires)) {
			errors.push({
				line: lineNumber,
				error: `Invalid expires timestamp: "${cookie.expires}"`,
				rawData,
			});
		}

		if (cookie.maxAge !== undefined && !this.isValidMaxAge(cookie.maxAge)) {
			errors.push({
				line: lineNumber,
				error: `Invalid maxAge: "${cookie.maxAge}"`,
				rawData,
			});
		}

		if (cookie.sameSite !== undefined && !this.isValidSameSite(cookie.sameSite)) {
			errors.push({
				line: lineNumber,
				error: `Invalid sameSite: "${cookie.sameSite}". Must be Strict, Lax, or None`,
				rawData,
			});
		}

		return errors;
	}

	private static isValidCookieValue(value: string): boolean {
		// Value не должно содержать ;, \n, \r
		return !value.includes(';') && !value.includes('\n') && !value.includes('\r') && value.length <= 4096; // RFC ограничение
	}

	private static isValidCookieName(name: string): boolean {
		// Не должно содержать =, ;, и не должно начинаться/заканчиваться пробелами
		return name.trim() === name && !name.includes('=') && !name.includes(';') && name.length > 0;
	}

	private static isValidDomain(domain: string): boolean {
		// Домен может начинаться с точки для поддоменов
		const cleanDomain = domain.startsWith('.') ? domain.slice(1) : domain;

		// Базовая проверка домена
		const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
		return domainRegex.test(cleanDomain) && cleanDomain.includes('.');
	}

	private static isValidPath(path: string): boolean {
		// Path должен начинаться с / и не содержать пробелов
		return typeof path === 'string' && path.startsWith('/') && !path.includes(' ') && !path.includes('\t');
	}

	private static isValidTimestamp(timestamp: number): boolean {
		// 0 = session cookie, иначе должен быть валидный unix timestamp
		return timestamp === 0 || (Number.isInteger(timestamp) && timestamp > 0 && timestamp < 4102444800); // до 2100 года
	}

	private static isValidMaxAge(maxAge: number): boolean {
		return Number.isInteger(maxAge) && maxAge >= 0;
	}

	private static isValidSameSite(sameSite: string): boolean {
		return ['Strict', 'Lax', 'None'].includes(sameSite);
	}
}
