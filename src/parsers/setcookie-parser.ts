import type { CookieRaw } from '../types';

export class SetCookieParser {
	static parse(line: string): Partial<CookieRaw> | null {
		const trimmed = line.trim();

		// Разделяем по первой точке с запятой для получения name=value
		const firstSemicolon = trimmed.indexOf(';');
		const nameValuePart = firstSemicolon === -1 ? trimmed : trimmed.substring(0, firstSemicolon);
		const attributesPart = firstSemicolon === -1 ? '' : trimmed.substring(firstSemicolon + 1);

		// Парсим name=value
		const equalIndex = nameValuePart.indexOf('=');
		if (equalIndex === -1) {
			return null;
		}

		const name = nameValuePart.substring(0, equalIndex).trim();
		const value = nameValuePart.substring(equalIndex + 1).trim();

		if (!name) {
			return null;
		}

		const cookie: Partial<CookieRaw> = {
			name,
			value,
		};

		// Парсим атрибуты
		if (attributesPart) {
			this.parseAttributes(attributesPart, cookie);
		}

		return cookie;
	}

	private static parseAttributes(attributesPart: string, cookie: Partial<CookieRaw>): void {
		// Разделяем по точкам с запятой
		const attributes = attributesPart.split(';');

		for (const attr of attributes) {
			const trimmedAttr = attr.trim();
			if (!trimmedAttr) continue;

			const equalIndex = trimmedAttr.indexOf('=');

			if (equalIndex === -1) {
				// Флаговые атрибуты без значения
				const attrName = trimmedAttr.toLowerCase();
				switch (attrName) {
					case 'secure':
						cookie.secure = true;
						break;
					case 'httponly':
						cookie.httpOnly = true;
						break;
				}
			} else {
				// Атрибуты со значением
				const attrName = trimmedAttr.substring(0, equalIndex).trim().toLowerCase();
				const attrValue = trimmedAttr.substring(equalIndex + 1).trim();

				switch (attrName) {
					case 'domain':
						cookie.domain = attrValue;
						break;
					case 'path':
						cookie.path = attrValue;
						break;
					case 'expires':
						// Сначала пробуем timestamp, потом GMT строку
						const timestamp = parseInt(attrValue, 10);
						if (!isNaN(timestamp)) {
							cookie.expires = timestamp;
						} else {
							// Парсим GMT строки типа "Wed, 01-Jul-2026 13:13:52 GMT"
							const gmtTimestamp = this.parseGMTDate(attrValue);
							if (gmtTimestamp !== null) {
								cookie.expires = gmtTimestamp;
							}
						}
						break;
					case 'max-age':
						const maxAge = parseInt(attrValue, 10);
						if (!isNaN(maxAge)) {
							cookie.maxAge = maxAge;
						}
						break;
					case 'samesite':
						const sameSite = attrValue as 'Strict' | 'Lax' | 'None';
						if (['Strict', 'Lax', 'None'].includes(sameSite)) {
							cookie.sameSite = sameSite;
						}
						break;
				}
			}
		}
	}

	private static parseGMTDate(dateString: string): number | null {
		try {
			// Убираем "GMT" в конце если есть
			const cleanDate = dateString.replace(/\s*GMT\s*$/i, '').trim();

			// Пробуем стандартный Date.parse
			const timestamp = Date.parse(cleanDate);
			if (!isNaN(timestamp)) {
				return Math.floor(timestamp / 1000); // конвертируем в unix timestamp
			}

			return null;
		} catch (error) {
			return null;
		}
	}
}
