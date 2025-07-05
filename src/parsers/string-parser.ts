import type { CookieRaw } from '../types';

/**
 * Быстрый парсер для строк вида "name1=value1; name2=value2"
 * Основан на алгоритме из phederal/cookie
 */
export class CookieStringParser {
	static parse(str: string): Record<string, string> {
		const obj = Object.create(null); // NullObject для производительности
		const len = str.length;

		// RFC 6265 требует минимум 2 символа для валидной cookie строки
		if (len < 2) return obj;

		let index = 0;

		do {
			const eqIdx = str.indexOf('=', index);
			if (eqIdx === -1) break; // Нет больше пар cookie

			const semicolonIdx = str.indexOf(';', index);
			const endIdx = semicolonIdx === -1 ? len : semicolonIdx;

			if (eqIdx > endIdx) {
				// Откатываемся к предыдущей точке с запятой
				index = str.lastIndexOf(';', eqIdx - 1) + 1;
				continue;
			}

			const keyStartIdx = this.skipWhitespace(str, index, eqIdx);
			const keyEndIdx = this.trimEndWhitespace(str, eqIdx, keyStartIdx);
			const key = str.slice(keyStartIdx, keyEndIdx);

			// Присваиваем только один раз (игнорируем дубликаты)
			if (obj[key] === undefined) {
				const valStartIdx = this.skipWhitespace(str, eqIdx + 1, endIdx);
				const valEndIdx = this.trimEndWhitespace(str, endIdx, valStartIdx);
				const value = this.decode(str.slice(valStartIdx, valEndIdx));
				obj[key] = value;
			}

			index = endIdx + 1;
		} while (index < len);

		return obj;
	}

	/**
	 * Конвертирует в формат CookieRaw для совместимости с остальной системой
	 */
	static parseToRawArray(str: string, domain: string = 'localhost'): Partial<CookieRaw>[] {
		const parsed = this.parse(str);
		const cookies: Partial<CookieRaw>[] = [];

		for (const [name, value] of Object.entries(parsed)) {
			cookies.push({
				name,
				value,
				domain,
				path: '/',
			});
		}

		return cookies;
	}

	private static skipWhitespace(str: string, index: number, max: number): number {
		while (index < max) {
			const code = str.charCodeAt(index);
			if (code !== 0x20 && code !== 0x09) return index; // не пробел и не табуляция
			index++;
		}
		return max;
	}

	private static trimEndWhitespace(str: string, index: number, min: number): number {
		while (index > min) {
			const code = str.charCodeAt(index - 1);
			if (code !== 0x20 && code !== 0x09) return index;
			index--;
		}
		return min;
	}

	/**
	 * Оптимизированное URL декодирование
	 * Проверяет наличие % перед вызовом decodeURIComponent
	 */
	private static decode(str: string): string {
		if (str.indexOf('%') === -1) return str;

		try {
			return decodeURIComponent(str);
		} catch {
			return str;
		}
	}
}
