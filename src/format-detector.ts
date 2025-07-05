import { CookieFormat } from './types';
import type { FormatDetectionResult } from './types';
import { WasmCookieDetector } from './wasm/wasm-detector';

export class CookieFormatDetector {
	private static wasmInitialized = false;
	private static wasmAvailable = false;

	// Статистика для отладки
	private static wasmHits = 0;
	private static fallbackHits = 0;
	private static fallbackSamples: string[] = [];

	/**
	 * Инициализация (вызывать при старте приложения)
	 */
	static async wasm(): Promise<void> {
		if (!this.wasmInitialized) {
			await WasmCookieDetector.init();
			this.wasmInitialized = true;
			this.wasmAvailable = WasmCookieDetector.isAvailable();
		}
	}

	/**
	 * Определяет формат cookie строки с максимальной точностью
	 * @param line Строка для анализа
	 * @returns Результат детектирования или null если формат не определен
	 */
	static detect(line: string): FormatDetectionResult | null {
		const trimmed = line.trim();
		if (trimmed.length === 0) return null;

		// Если WASM инициализирован - проверяем его доступность
		if (this.wasmInitialized && !this.wasmAvailable) {
			this.wasmAvailable = WasmCookieDetector.isAvailable();
		}

		// WASM путь (если доступен)
		if (this.wasmAvailable) {
			const wasmResult = WasmCookieDetector.detect(trimmed);
			if (wasmResult) {
				this.wasmHits++;
				return wasmResult;
			} else {
				// ДЕТАЛЬНАЯ ДИАГНОСТИКА КАЖДОГО FALLBACK:
				this.fallbackHits++;

				// Сохраняем ТОЧНУЮ строку (не обрезанную)
				if (this.fallbackSamples.length < 10) {
					this.fallbackSamples.push(trimmed);
				}

				// ЛОГИРУЕМ первые несколько fallback:
				if (this.fallbackHits <= 5) {
					console.log(`FALLBACK #${this.fallbackHits}:`);
					console.log(`  String: "${trimmed}"`);
					console.log(`  Length: ${trimmed.length}`);
					console.log(`  Bytes: [${Array.from(new TextEncoder().encode(trimmed)).slice(0, 20).join(',')}...]`);
					console.log(`  First char: ${trimmed.charCodeAt(0)} ('${trimmed[0]}')`);
					console.log(`  Last char: ${trimmed.charCodeAt(trimmed.length - 1)} ('${trimmed[trimmed.length - 1]}')`);
					console.log('---');
				}

				return this.detectFallback(trimmed);
			}
		}

		// TypeScript fallback (если WASM недоступен)
		this.fallbackHits++;
		return this.detectFallback(trimmed);
	}

	/**
	 * Статистика использования WASM vs fallback
	 */
	static getStats() {
		const total = this.wasmHits + this.fallbackHits;
		return {
			wasmHits: this.wasmHits,
			fallbackHits: this.fallbackHits,
			total,
			wasmPercentage: total > 0 ? ((this.wasmHits / total) * 100).toFixed(1) : '0',
			wasmAvailable: this.wasmAvailable,
			fallbackSamples: this.fallbackSamples,
		};
	}

	/**
	 * Сброс статистики
	 */
	static resetStats() {
		this.wasmHits = 0;
		this.fallbackHits = 0;
		this.fallbackSamples = [];
	}

	/**
	 * TypeScript fallback для случаев когда WASM недоступен
	 */
	private static detectFallback(line: string): FormatDetectionResult | null {
		// Быстрое исключение комментариев
		if (this.isComment(line)) return null;

		// Структурное определение формата
		const format = this.detectByStructure(line);
		if (!format) return null;

		// Строгая валидация соответствия формату
		return this.validateFormat(line, format);
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
		return structure.fieldCount === 7 && structure.totalSeparators >= 6;
	}

	/**
	 * Проверяет соответствие структуры SetCookie формату
	 */
	private static isSetCookieStructure(structure: any, line: string): boolean {
		if (structure.equalCount === 0) return false;

		const firstEqualIndex = line.indexOf('=');
		if (firstEqualIndex <= 0) return false;

		const cookieName = line.slice(0, firstEqualIndex).trim();
		if (!this.isValidCookieName(cookieName) || this.isCookieAttribute(cookieName)) {
			return false;
		}

		// ИСПРАВЛЕНИЕ: Более строгая проверка Netscape паттернов (включая неполные)
		if (structure.fieldCount >= 5 && structure.totalSeparators >= 4) {
			// Изменено с 6/5 на 5/4
			const fields = this.parseNetscapeFields(line);

			// Если есть boolean паттерн в позициях 1 и 3 - это Netscape (даже неполный)
			if (fields.length >= 4 && this.hasNetscapeBooleanPattern(fields)) {
				return false; // Отклоняем как SetCookie
			}
		}

		return true;
	}

	private static hasNetscapeBooleanPattern(fields: string[]): boolean {
		// Для корректного Netscape нужны позиции 1 и 3 (includeSubdomains и secure)
		if (fields.length < 4) return false;

		const field2 = fields[1]?.toUpperCase(); // includeSubdomains
		const field4 = fields[3]?.toUpperCase(); // secure

		// Оба поля должны быть boolean значениями
		return (field2 === 'TRUE' || field2 === 'FALSE') && (field4 === 'TRUE' || field4 === 'FALSE');
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
			lines: [line],
		};
	}

	/**
	 * Валидация Netscape формата
	 */
	private static validateNetscapeFormat(line: string): FormatDetectionResult | null {
		const cleanLine = line.startsWith('#HttpOnly_') ? line.slice(10) : line;
		const fields = this.parseNetscapeFields(cleanLine);

		// КРИТИЧНО: Строго 7 полей, не больше, не меньше
		if (fields.length !== 7) return null;

		const [domain, includeSubdomains, path, secure, expires, name, value] = fields;

		// Проверка что все поля присутствуют (не undefined и не пустые)
		if (!domain || !includeSubdomains || !path || !secure || expires === undefined || !name || value === undefined) {
			return null;
		}

		// Валидация типов полей
		if (!this.isValidDomain(domain)) return null;
		if (!this.isValidBoolean(includeSubdomains)) return null;
		if (!this.isValidPath(path)) return null;
		if (!this.isValidBoolean(secure)) return null;
		if (!this.isValidTimestamp(expires)) return null;
		if (!this.isValidCookieName(name)) return null;

		return {
			format: CookieFormat.NETSCAPE,
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

		// IP адрес проверка без regex
		if (this.isIPAddress(domain)) return true;

		// Обычные домены должны содержать точку
		const cleanDomain = domain.startsWith('.') ? domain.slice(1) : domain;
		return cleanDomain.length > 0 && cleanDomain.includes('.') && this.isValidDomainChars(cleanDomain);
	}

	private static isIPAddress(domain: string): boolean {
		const parts = domain.split('.');
		if (parts.length !== 4) return false;

		for (const part of parts) {
			if (part.length === 0) return false;
			for (let i = 0; i < part.length; i++) {
				const code = part.charCodeAt(i);
				if (code < 0x30 || code > 0x39) return false; // не цифра
			}
			const num = parseInt(part, 10);
			if (num > 255) return false;
		}
		return true;
	}

	private static isValidDomainChars(domain: string): boolean {
		for (let i = 0; i < domain.length; i++) {
			const code = domain.charCodeAt(i);
			// a-z, A-Z, 0-9, '.', '-'
			if (!((code >= 0x61 && code <= 0x7a) || (code >= 0x41 && code <= 0x5a) || (code >= 0x30 && code <= 0x39) || code === 0x2e || code === 0x2d)) {
				return false;
			}
		}
		return true;
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

		// Проверка что все символы - цифры
		for (let i = 0; i < timestamp.length; i++) {
			const code = timestamp.charCodeAt(i);
			if (code < 0x30 || code > 0x39) return false; // не цифра
		}

		const num = parseInt(timestamp, 10);
		return num > 0 && num < 4102444800; // до 2100 года
	}

	/**
	 * Проверяет наличие множественных name=value пар в атрибутах
	 */
	private static hasMultipleNameValuePairs(attributes: string): boolean {
		const knownAttributes = ['domain', 'path', 'expires', 'max-age', 'samesite', 'httponly', 'secure', 'partitioned', 'priority'];

		const parts = attributes.split(';');

		for (const part of parts) {
			const trimmed = part.trim();
			if (trimmed.includes('=')) {
				const equalIndex = trimmed.indexOf('=');
				const name = trimmed.slice(0, equalIndex).trim().toLowerCase();

				// ИСПРАВЛЕНИЕ: Не считаем множественными если это известный атрибут
				if (!knownAttributes.includes(name)) {
					// Дополнительная проверка: если имя не выглядит как cookie name
					if (this.looksLikeCookieName(name)) {
						return true; // это дополнительная cookie пара
					}
				}
			}
		}

		return false;
	}

	private static looksLikeCookieName(name: string): boolean {
		// Простые имена вроде cookie1, cookie2, session, csrf и т.д.
		return name.length > 0 && name.length < 50 && /^[a-zA-Z0-9_-]+$/.test(name);
	}
}
