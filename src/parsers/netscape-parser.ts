import type { CookieRaw } from '../types';

export class NetscapeParser {
	static parse(line: string): Partial<CookieRaw> | null {
		const len = line.length;
		if (len < 7) return null; // Минимум для валидной строки Netscape

		let index = 0;

		// Проверяем HttpOnly префикс
		const isHttpOnly = line.startsWith('#HttpOnly_');
		if (isHttpOnly) {
			index = 10; // пропускаем "#HttpOnly_"
		}

		// Парсим 7 полей разделенных табами или пробелами
		const fields: string[] = [];
		let fieldStart = index;

		for (let fieldIndex = 0; fieldIndex < 7 && index <= len; fieldIndex++) {
			// Ищем следующий разделитель (таб или пробел)
			while (index < len) {
				const code = line.charCodeAt(index);
				if (code === 0x09 || code === 0x20) break; // таб или пробел
				index++;
			}

			// Добавляем поле
			if (index > fieldStart || fieldIndex === 6) {
				// Для последнего поля берем до конца строки
				const fieldEnd = fieldIndex === 6 ? len : index;
				fields.push(line.slice(fieldStart, fieldEnd));
			}

			if (fieldIndex === 6) break;

			// Пропускаем разделители
			while (index < len) {
				const code = line.charCodeAt(index);
				if (code !== 0x09 && code !== 0x20) break;
				index++;
			}

			fieldStart = index;
		}

		if (fields.length !== 7) return null;

		const [domain, includeSubdomains, path, secure, expires, name, value] = fields;

		// Быстрая валидация обязательных полей
		if (!domain || !name || value === undefined) return null;

		try {
			const cookie: Partial<CookieRaw> = {
				domain: includeSubdomains!.toUpperCase() === 'TRUE' ? '.' + domain : domain,
				path: path || '/',
				secure: secure!.toUpperCase() === 'TRUE',
				expires: this.parseExpires(expires!),
				name,
				value,
				httpOnly: isHttpOnly,
			};

			return cookie;
		} catch {
			return null;
		}
	}

	private static parseExpires(expiresStr: string): number {
		// Быстрая проверка на число
		if (this.isNumericString(expiresStr)) {
			const timestamp = parseInt(expiresStr, 10);
			if (!isNaN(timestamp)) return timestamp;
		}

		// Парсим GMT строки
		try {
			const cleanDate = expiresStr.replace(/\s*GMT\s*$/i, '').trim();
			const gmtTimestamp = Date.parse(cleanDate);
			if (!isNaN(gmtTimestamp)) {
				return Math.floor(gmtTimestamp / 1000);
			}
		} catch {
			// ignore
		}

		return 0; // fallback to session cookie
	}

	private static isNumericString(str: string): boolean {
		if (!str.length) return false;
		for (let i = 0; i < str.length; i++) {
			const code = str.charCodeAt(i);
			if (code < 48 || code > 57) return false; // не цифра 0-9
		}
		return true;
	}
}
