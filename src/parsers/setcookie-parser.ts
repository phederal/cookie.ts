import type { CookieRaw } from '../types';

export class SetCookieParser {
	static parse(line: string): Partial<CookieRaw> | null {
		const len = line.length;
		if (len < 3) return null; // Минимум: "a=b"

		let index = 0;

		// Пропускаем начальные пробелы
		index = this.skipWhitespace(line, index, len);
		if (index >= len) return null;

		// Ищем первый знак равенства для name=value
		const eqIdx = line.indexOf('=', index);
		if (eqIdx === -1) return null;

		// Извлекаем name (обрезаем пробелы)
		const nameStartIdx = index;
		const nameEndIdx = this.trimEndWhitespace(line, eqIdx, nameStartIdx);
		const name = line.slice(nameStartIdx, nameEndIdx);
		if (!name) return null;

		// Ищем конец значения (до первой точки с запятой)
		const semicolonIdx = line.indexOf(';', eqIdx + 1);
		const valueEndIdx = semicolonIdx === -1 ? len : semicolonIdx;

		// Извлекаем value (обрезаем пробелы)
		const valueStartIdx = this.skipWhitespace(line, eqIdx + 1, valueEndIdx);
		const valueActualEndIdx = this.trimEndWhitespace(line, valueEndIdx, valueStartIdx);
		const value = line.slice(valueStartIdx, valueActualEndIdx);

		const cookie: Partial<CookieRaw> = { name, value };

		// Парсим атрибуты если есть точка с запятой
		if (semicolonIdx !== -1) {
			this.parseAttributes(line, semicolonIdx + 1, len, cookie);
		}

		return cookie;
	}

	private static parseAttributes(str: string, startIdx: number, len: number, cookie: Partial<CookieRaw>): void {
		let index = startIdx;

		while (index < len) {
			// Пропускаем пробелы перед атрибутом
			index = this.skipWhitespace(str, index, len);
			if (index >= len) break;

			// Ищем конец текущего атрибута (до следующей точки с запятой)
			const nextSemicolon = str.indexOf(';', index);
			const attrEndIdx = nextSemicolon === -1 ? len : nextSemicolon;

			// Ищем знак равенства в атрибуте
			const attrEqIdx = str.indexOf('=', index);

			if (attrEqIdx === -1 || attrEqIdx >= attrEndIdx) {
				// Флаговый атрибут без значения
				const attrName = str.slice(index, attrEndIdx).trim().toLowerCase();
				this.processFlagAttribute(attrName, cookie);
			} else {
				// Атрибут со значением
				const attrName = str.slice(index, attrEqIdx).trim().toLowerCase();
				const attrValueStartIdx = this.skipWhitespace(str, attrEqIdx + 1, attrEndIdx);
				const attrValueEndIdx = this.trimEndWhitespace(str, attrEndIdx, attrValueStartIdx);
				const attrValue = str.slice(attrValueStartIdx, attrValueEndIdx);

				this.processValueAttribute(attrName, attrValue, cookie);
			}

			index = nextSemicolon === -1 ? len : nextSemicolon + 1;
		}
	}

	private static processFlagAttribute(attrName: string, cookie: Partial<CookieRaw>): void {
		switch (attrName) {
			case 'secure':
				cookie.secure = true;
				break;
			case 'httponly':
				cookie.httpOnly = true;
				break;
		}
	}

	private static processValueAttribute(attrName: string, attrValue: string, cookie: Partial<CookieRaw>): void {
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
				if (['Strict', 'Lax', 'None'].includes(attrValue)) {
					cookie.sameSite = attrValue as 'Strict' | 'Lax' | 'None';
				}
				break;
		}
	}

	private static skipWhitespace(str: string, index: number, max: number): number {
		while (index < max) {
			const code = str.charCodeAt(index);
			if (code !== 0x20 && code !== 0x09) break; // не пробел и не табуляция
			index++;
		}
		return index;
	}

	private static trimEndWhitespace(str: string, index: number, min: number): number {
		while (index > min) {
			const code = str.charCodeAt(index - 1);
			if (code !== 0x20 && code !== 0x09) break;
			index--;
		}
		return index;
	}

	private static parseGMTDate(dateString: string): number | null {
		try {
			const cleanDate = dateString.replace(/\s*GMT\s*$/i, '').trim();
			const timestamp = Date.parse(cleanDate);
			if (!isNaN(timestamp)) {
				return Math.floor(timestamp / 1000);
			}
			return null;
		} catch {
			return null;
		}
	}
}
