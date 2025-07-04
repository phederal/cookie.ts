import type { CookieRaw } from '../types.ts';

export class JsonParser {
	static parse(jsonString: string): Partial<CookieRaw>[] | null {
		try {
			const parsed = JSON.parse(jsonString);

			// Поддерживаем и массив объектов и один объект
			const cookieArray = Array.isArray(parsed) ? parsed : [parsed];

			const results: Partial<CookieRaw>[] = [];

			for (const item of cookieArray) {
				const cookie = this.parseSingleCookie(item);
				if (cookie) {
					results.push(cookie);
				}
			}

			return results.length > 0 ? results : null;
		} catch (error) {
			return null;
		}
	}

	private static parseSingleCookie(item: any): Partial<CookieRaw> | null {
		if (!item || typeof item !== 'object') {
			return null;
		}

		// Проверяем обязательные поля
		if (!item.name || typeof item.name !== 'string') {
			return null;
		}

		if (item.value === undefined || item.value === null) {
			return null;
		}

		if (!item.domain || typeof item.domain !== 'string') {
			return null;
		}

		const cookie: Partial<CookieRaw> = {
			name: item.name,
			value: String(item.value), // конвертируем в string на всякий случай
			domain: item.domain,
		};

		// Опциональные поля
		if (item.path && typeof item.path === 'string') {
			cookie.path = item.path;
		}

		if (typeof item.expires === 'number') {
			cookie.expires = item.expires;
		}

		if (typeof item.maxAge === 'number') {
			cookie.maxAge = item.maxAge;
		}

		if (typeof item.secure === 'boolean') {
			cookie.secure = item.secure;
		}

		if (typeof item.httpOnly === 'boolean') {
			cookie.httpOnly = item.httpOnly;
		}

		if (typeof item.includeSubdomains === 'boolean') {
			cookie.domain = item.includeSubdomains ? `.${item.domain}` : item.domain;
		}

		if (item.sameSite && ['Strict', 'Lax', 'None'].includes(item.sameSite)) {
			cookie.sameSite = item.sameSite as 'Strict' | 'Lax' | 'None';
		}

		return cookie;
	}
}
