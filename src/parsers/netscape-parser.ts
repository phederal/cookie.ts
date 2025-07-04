import type { CookieRaw } from '../types';

export class NetscapeParser {
	static parse(line: string): Partial<CookieRaw> | null {
		const trimmed = line.trim();

		// Проверяем HttpOnly префикс
		const isHttpOnly = trimmed.startsWith('#HttpOnly_');
		const cookieLine = isHttpOnly ? trimmed.substring(10) : trimmed; // убираем "#HttpOnly_"

		// Более быстрый способ парсинга с regex
		const match = cookieLine.match(/^([^\t\s]+)[\t\s]+([^\t\s]+)[\t\s]+([^\t\s]+)[\t\s]+([^\t\s]+)[\t\s]+([^\t\s]+)[\t\s]+([^\t\s]+)[\t\s]+(.*)$/);

		/**
		 * domain\tTRUE\t/\tFALSE\t123\tname\tvalue (табы)
		 * domain TRUE / FALSE 123 name value (пробелы)
		 * domain    TRUE  /   FALSE  123  name  value (много пробелов)
		 * domain\t  TRUE \t/\t FALSE\t123\tname\tvalue (смешанно)
		 * domain\t\t\tTRUE\t\t/\t\tFALSE (много табов)
		 * domain\t\t\t\t\t\tTRUE (очень много табов)
		 * domain\t   \t  \tTRUE (табы + пробелы вперемешку)
		 * domain        TRUE (много пробелов)
		 */

		if (!match) {
			return null;
		}

		const [, domain, includeSubdomains, path, secure, expires, name, value] = match;

		// ts check
		if (!domain || !includeSubdomains || !path || !secure || !expires || !name || !value) {
			return null;
		}

		try {
			const cookie: Partial<CookieRaw> = {
				domain: includeSubdomains.trim().toUpperCase() === 'TRUE' ? '.' + domain.trim() : domain.trim(),
				path: path.trim() || '/',
				secure: secure.trim().toUpperCase() === 'TRUE',
				expires: this.parseExpires(expires.trim()),
				name: name.trim(),
				value: value.trim(), // value может содержать всё остальное включая пробелы
				httpOnly: isHttpOnly,
			};

			return cookie;
		} catch (error) {
			return null;
		}
	}

	private static parseExpires(expiresStr: string): number {
		// Сначала пробуем timestamp
		const timestamp = parseInt(expiresStr, 10);
		if (!isNaN(timestamp)) {
			return timestamp;
		}

		// Парсим GMT строки
		try {
			const cleanDate = expiresStr.replace(/\s*GMT\s*$/i, '').trim();
			const gmtTimestamp = Date.parse(cleanDate);
			if (!isNaN(gmtTimestamp)) {
				return Math.floor(gmtTimestamp / 1000);
			}
		} catch (error) {
			// ignore
		}

		return 0; // fallback to session cookie
	}
}
