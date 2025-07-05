import { CookieFormat } from './types';
import type { FormatDetectionResult } from './types';

/**
 * Строгий детектор форматов cookies с нулевым уровнем ложных срабатываний
 * Использует структурный анализ вместо нечеткой логики scoring
 */
export class CookieFormatDetector {
	/**
	 * Определяет формат cookie строки с максимальной точностью
	 * @param line Строка для анализа
	 * @returns Результат детектирования или null если формат не определен
	 */
	static detect(line: string): FormatDetectionResult | null {
		const trimmed = line.trim();
		if (trimmed.length === 0) return null;

		// Быстрое исключение комментариев
		if (this.isComment(trimmed)) return null;

		// Структурное определение формата
		const format = this.detectByStructure(trimmed);
		if (!format) return null;

		// Строгая валидация соответствия формату
		return this.validateFormat(trimmed, format);
	}

	/**
	 * Проверяет является ли строка комментарием
	 */
	private static isComment(line: string): boolean {
		const firstChar = line.charCodeAt(0);

		if (firstChar === 0x23) {
			// '#'
			// Исключение: #HttpOnly_ - это префикс Netscape формата
			return !line.startsWith('#HttpOnly_');
		}

		if (firstChar === 0x2f && line.length > 1) {
			// '/'
			const secondChar = line.charCodeAt(1);
			return secondChar === 0x2f || secondChar === 0x2a; // '//' или '/*'
		}

		// HTML комментарии
		if (line.startsWith('<!--')) return true;

		return false;
	}

	/**
	 * Определяет формат по структурным признакам
	 */
	private static detectByStructure(line: string): CookieFormat | null {
		const firstChar = line.charCodeAt(0);

		// JSON: строго начинается с { или [
		if (firstChar === 0x7b || firstChar === 0x5b) {
			return this.isValidJsonStructure(line) ? CookieFormat.JSON : null;
		}

		// Убираем #HttpOnly_ префикс для анализа
		const cleanLine = line.startsWith('#HttpOnly_') ? line.slice(10) : line;

		// Анализ структуры для различения Netscape и SetCookie
		const structure = this.analyzeLineStructure(cleanLine);

		// Netscape: строго 7 полей с систематическими разделителями
		if (this.isNetscapeStructure(structure)) {
			return CookieFormat.NETSCAPE;
		}

		// SetCookie: name=value формат без систематических разделителей
		if (this.isSetCookieStructure(structure, cleanLine)) {
			return CookieFormat.SET_COOKIE;
		}

		return null;
	}

	/**
	 * Проверяет валидность JSON структуры
	 */
	private static isValidJsonStructure(line: string): boolean {
		try {
			const parsed = JSON.parse(line);

			// Должен быть объект или массив
			if (typeof parsed !== 'object' || parsed === null) return false;

			// Для объекта - проверяем наличие обязательных полей cookie
			if (!Array.isArray(parsed)) {
				return this.hasRequiredCookieFields(parsed);
			}

			// Для массива - проверяем что все элементы валидные cookie объекты
			if (parsed.length === 0) return false;
			return parsed.every((item: any) => typeof item === 'object' && item !== null && this.hasRequiredCookieFields(item));
		} catch {
			return false;
		}
	}

	/**
	 * Проверяет наличие обязательных полей cookie в JSON объекте
	 */
	private static hasRequiredCookieFields(obj: any): boolean {
		return typeof obj.name === 'string' && obj.name.length > 0 && 'value' in obj;
	}

	/**
	 * Анализирует структуру строки
	 */
	private static analyzeLineStructure(line: string) {
		let fieldCount = 1; // начинаем с 1 поля (первое поле до разделителя)
		let tabCount = 0;
		let spaceGroupCount = 0;
		let equalCount = 0;
		let semicolonCount = 0;
		let inWhitespace = false;

		for (let i = 0; i < line.length; i++) {
			const char = line.charCodeAt(i);

			if (char === 0x09) {
				// tab
				tabCount++;
				if (!inWhitespace) fieldCount++;
				inWhitespace = true;
			} else if (char === 0x20) {
				// space
				if (!inWhitespace) {
					spaceGroupCount++;
					fieldCount++;
				}
				inWhitespace = true;
			} else {
				inWhitespace = false;

				if (char === 0x3d) equalCount++; // '='
				else if (char === 0x3b) semicolonCount++; // ';'
			}
		}

		return {
			fieldCount,
			tabCount,
			spaceGroupCount,
			equalCount,
			semicolonCount,
			hasSystematicSeparators: tabCount >= 6 || spaceGroupCount >= 6,
			totalSeparators: tabCount + spaceGroupCount,
		};
	}

	/**
	 * Проверяет соответствие структуры Netscape формату
	 */
	private static isNetscapeStructure(structure: any): boolean {
		// Netscape: ровно 7 полей, разделенных табами или пробелами
		return structure.fieldCount === 7 && structure.totalSeparators >= 6 && structure.equalCount <= 1; // может быть = в значении cookie
	}

	/**
	 * Проверяет соответствие структуры SetCookie формату
	 */
	private static isSetCookieStructure(structure: any, line: string): boolean {
		// SetCookie должен иметь name=value
		if (structure.equalCount === 0) return false;

		// Проверяем что первая часть до = - валидное имя cookie
		const firstEqualIndex = line.indexOf('=');
		if (firstEqualIndex <= 0) return false;

		const cookieName = line.slice(0, firstEqualIndex).trim();
		if (!this.isValidCookieName(cookieName) || this.isCookieAttribute(cookieName)) {
			return false;
		}

		// Исключаем строки которые выглядят как Netscape формат:
		// - 7+ полей через систематические разделители (tab/space)
		// - содержат TRUE/FALSE как отдельные поля
		if (structure.fieldCount >= 7 && structure.totalSeparators >= 6) {
			// Дополнительная проверка: содержит ли TRUE/FALSE как отдельные слова
			const upperLine = line.toUpperCase();
			const hasBooleanFields =
				/\s(TRUE|FALSE)(?=\s)/gi.test(line) || /(?<=\s)(TRUE|FALSE)\s/gi.test(line) || /^(TRUE|FALSE)\s/gi.test(line) || /\s(TRUE|FALSE)$/gi.test(line);

			if (hasBooleanFields) return false;
		}

		return true;
	}

	/**
	 * Проверяет валидность имени cookie
	 */
	private static isValidCookieName(name: string): boolean {
		if (name.length === 0 || name.length > 256) return false;

		// RFC 6265: cookie-name не должно содержать управляющие символы, пробелы, =, ;
		for (let i = 0; i < name.length; i++) {
			const code = name.charCodeAt(i);
			if (code < 0x21 || code === 0x3b || code === 0x3d || code > 0x7e) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Проверяет является ли строка атрибутом SetCookie
	 */
	private static isCookieAttribute(name: string): boolean {
		const lowerName = name.toLowerCase();
		return ['domain', 'path', 'expires', 'max-age', 'samesite', 'httponly', 'secure', 'partitioned', 'priority'].includes(lowerName);
	}

	/**
	 * Выполняет финальную валидацию формата
	 */
	private static validateFormat(line: string, format: CookieFormat): FormatDetectionResult | null {
		switch (format) {
			case CookieFormat.JSON:
				return this.validateJsonFormat(line);

			case CookieFormat.NETSCAPE:
				return this.validateNetscapeFormat(line);

			case CookieFormat.SET_COOKIE:
				return this.validateSetCookieFormat(line);

			default:
				return null;
		}
	}

	/**
	 * Валидация JSON формата
	 */
	private static validateJsonFormat(line: string): FormatDetectionResult {
		// JSON уже проверен в isValidJsonStructure
		return {
			format: CookieFormat.JSON,
			confidence: 1.0,
			lines: [line],
		};
	}

	/**
	 * Валидация Netscape формата
	 */
	private static validateNetscapeFormat(line: string): FormatDetectionResult | null {
		// Убираем #HttpOnly_ префикс для валидации
		const cleanLine = line.startsWith('#HttpOnly_') ? line.slice(10) : line;
		const fields = this.parseNetscapeFields(cleanLine);

		if (fields.length !== 7) return null;

		const [domain, includeSubdomains, path, secure, expires, name, value] = fields;

		// Валидация полей
		if (!this.isValidDomain(domain)) return null;
		if (!this.isValidBoolean(includeSubdomains)) return null;
		if (!this.isValidPath(path)) return null;
		if (!this.isValidBoolean(secure)) return null;
		if (!this.isValidTimestamp(expires)) return null;
		if (!this.isValidCookieName(name)) return null;
		// value может быть любым

		return {
			format: CookieFormat.NETSCAPE,
			confidence: 1.0,
			lines: [line],
		};
	}

	/**
	 * Валидация SetCookie формата
	 */
	private static validateSetCookieFormat(line: string): FormatDetectionResult | null {
		const firstEqualIndex = line.indexOf('=');
		const cookieName = line.slice(0, firstEqualIndex).trim();

		// Имя уже проверено в isSetCookieStructure
		// Проверяем что после ; нет множественных name=value пар
		const semicolonIndex = line.indexOf(';');
		if (semicolonIndex !== -1) {
			const attributes = line.slice(semicolonIndex + 1);
			if (this.hasMultipleNameValuePairs(attributes)) return null;
		}

		return {
			format: CookieFormat.SET_COOKIE,
			confidence: 1.0,
			lines: [line],
		};
	}

	/**
	 * Парсит поля Netscape формата
	 */
	private static parseNetscapeFields(line: string): string[] {
		const fields: string[] = [];
		let start = 0;
		let inField = false;

		for (let i = 0; i <= line.length; i++) {
			const char = i < line.length ? line.charCodeAt(i) : 0;
			const isWhitespace = char === 0x09 || char === 0x20;

			if (!isWhitespace && !inField) {
				start = i;
				inField = true;
			} else if ((isWhitespace || i === line.length) && inField) {
				fields.push(line.slice(start, i));
				inField = false;
			}
		}

		return fields;
	}

	/**
	 * Проверяет валидность домена
	 */
	private static isValidDomain(domain: string): boolean {
		if (domain.length === 0) return false;

		// Специальные случаи
		if (domain === 'localhost' || domain.startsWith('localhost:')) return true;
		if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) return true; // IP адрес

		// Обычные домены должны содержать точку
		const cleanDomain = domain.startsWith('.') ? domain.slice(1) : domain;
		return cleanDomain.length > 0 && cleanDomain.includes('.') && !/[^a-zA-Z0-9.-]/.test(cleanDomain);
	}

	/**
	 * Проверяет валидность булевого значения
	 */
	private static isValidBoolean(value: string): boolean {
		const upper = value.toUpperCase();
		return upper === 'TRUE' || upper === 'FALSE';
	}

	/**
	 * Проверяет валидность пути
	 */
	private static isValidPath(path: string): boolean {
		return path.length > 0 && path.startsWith('/');
	}

	/**
	 * Проверяет валидность timestamp
	 */
	private static isValidTimestamp(timestamp: string): boolean {
		if (timestamp === '0') return true; // session cookie

		// Должно быть числом
		if (!/^\d+$/.test(timestamp)) return false;

		const num = parseInt(timestamp, 10);
		return num > 0 && num < 4102444800; // до 2100 года
	}

	/**
	 * Проверяет наличие множественных name=value пар в атрибутах
	 */
	private static hasMultipleNameValuePairs(attributes: string): boolean {
		// Известные SetCookie атрибуты (case-insensitive)
		const knownAttributes = ['domain', 'path', 'expires', 'max-age', 'samesite', 'httponly', 'secure', 'partitioned', 'priority'];

		const parts = attributes.split(';');

		for (const part of parts) {
			const trimmed = part.trim();
			if (trimmed.includes('=')) {
				const [name] = trimmed.split('=', 1);
				const attrName = name.trim().toLowerCase();

				// Если найден атрибут с = который не является известным SetCookie атрибутом
				if (!knownAttributes.includes(attrName)) {
					return true; // это дополнительная name=value пара, не атрибут
				}
			}
		}

		return false;
	}
}
