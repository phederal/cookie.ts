import { CookieFormat } from './types';
import type { FormatDetectionResult } from './types';

export class CookieFormatDetector {
	static detect(line: string): FormatDetectionResult | null {
		const len = line.length;
		if (len === 0) return null;

		// Быстрая проверка первого символа для исключения комментариев
		const firstChar = line.charCodeAt(0);

		// Пропускаем пустые строки и комментарии (кроме #HttpOnly_)
		if (firstChar === 0x23) {
			// '#'
			if (!line.startsWith('#HttpOnly_')) return null;
		} else if (firstChar === 0x2f) {
			// '/'
			// Проверяем на // или /*
			if (len > 1 && (line.charCodeAt(1) === 0x2f || line.charCodeAt(1) === 0x2a)) {
				return null;
			}
		}

		// Быстрое определение формата по первому символу
		if (firstChar === 0x7b || firstChar === 0x5b) {
			// '{' или '['
			// Check JSON format
			const confidence = this.calculateJsonConfidence(line);
			if (confidence >= 0.7) {
				return {
					format: CookieFormat.JSON,
					confidence,
					lines: [line],
				};
			}
			return null;
		}

		// Проверяем на наличие табуляций (характерно для Netscape)
		const hasTab = line.indexOf('\t') !== -1;
		const hasSpace = line.indexOf(' ') !== -1;
		const hasEquals = line.indexOf('=') !== -1;

		if ((hasTab || hasSpace) && this.netscapeCheck(line)) {
			const confidence = this.calculateNetscapeConfidence(line);
			if (confidence >= 0.7) {
				return {
					format: CookieFormat.NETSCAPE,
					confidence,
					lines: [line],
				};
			}
		}

		if (hasEquals) {
			// Проверяем Set-Cookie формат
			const setCookieConfidence = this.calculateSetCookieConfidence(line);
			if (setCookieConfidence >= 0.7) {
				return {
					format: CookieFormat.SET_COOKIE,
					confidence: setCookieConfidence,
					lines: [line],
				};
			}
		}

		return null;
	}

	private static netscapeCheck(line: string): boolean {
		let separatorCount = 0;
		for (let i = 0; i < line.length; i++) {
			const code = line.charCodeAt(i);
			if (code === 0x09 || code === 0x20) {
				// таб ИЛИ пробел
				while (i + 1 < line.length) {
					const nextCode = line.charCodeAt(i + 1);
					if (nextCode !== 0x09 && nextCode !== 0x20) break;
					i++;
				}
				separatorCount++;
			}
		}
		return separatorCount >= 6;
	}

	private static calculateJsonConfidence(line: string): number {
		// Простая проверка на JSON объект или массив
		if (!(line.startsWith('[') || line.startsWith('{'))) {
			return 0;
		}

		// because json structure
		let confidence = 0.3;

		// Required RFC 6265 fields
		let requiredCount = 0;
		if (line.includes('"name":')) requiredCount++;
		if (line.includes('"value":')) requiredCount++;

		if (requiredCount === 2) {
			confidence += 0.3;
		}

		// Important RFC 6265 fields
		let importantCount = 0;
		if (line.includes('"domain":')) importantCount++;
		if (line.includes('"path":')) importantCount++;
		if (line.includes('"expires":')) importantCount++;

		confidence += importantCount * 0.1;

		// Optional fields
		let optionalCount = 0;
		if (line.includes('"secure":')) optionalCount++;
		if (line.includes('"maxAge":')) optionalCount++;
		if (line.includes('"max-age":')) optionalCount++;
		if (line.includes('"httpOnly":')) optionalCount++;
		if (line.includes('"httponly":')) optionalCount++;
		if (line.includes('"SameSite":')) optionalCount++;
		if (line.includes('"samesite":')) optionalCount++;
		if (line.includes('"partitioned":')) optionalCount++;
		if (line.includes('"priority":')) optionalCount++;
		if (line.includes('"includeSubdomains":')) optionalCount++;
		if (line.includes('"includeSubDomains":')) optionalCount++;
		if (line.includes('"session":')) optionalCount++;

		confidence += optionalCount * 0.05;

		return Math.min(confidence, 1);
	}

	private static calculateSetCookieConfidence(line: string): number {
		// Быстрая проверка на name=value без regex
		const equalIndex = line.indexOf('=');
		if (equalIndex === -1 || equalIndex === 0) {
			return 0;
		}

		// Проверяем что перед = нет пробелов и точек с запятой
		const nameChar = line.charCodeAt(equalIndex - 1);
		if (nameChar === 0x20 || nameChar === 0x3b) {
			// пробел или точка с запятой
			return 0;
		}

		let confidence = 0.4; // базовый за name=value

		// Создаем lowercase версию один раз
		const lowerLine = line.toLowerCase();

		// Прямые проверки атрибутов без массивов
		let attributeCount = 0;

		if (lowerLine.includes('path=')) attributeCount++;
		if (lowerLine.includes('domain=')) attributeCount++;
		if (lowerLine.includes('expires=')) attributeCount++;
		if (lowerLine.includes('max-age=')) attributeCount++;
		if (lowerLine.includes('secure')) attributeCount++;
		if (lowerLine.includes('httponly')) attributeCount++;
		if (lowerLine.includes('samesite=')) attributeCount++;

		confidence += attributeCount * 0.08;

		// Проверка на точку с запятой
		if (line.includes(';')) {
			confidence += 0.25;
		}

		// Дополнительные проверки для повышения точности
		// Проверяем что имя cookie выглядит разумно (буквы, цифры, -, _)
		const cookieName = line.slice(0, equalIndex);
		if (this.isValidCookieName(cookieName)) {
			confidence += 0.05;
		}

		return Math.min(confidence, 1);
	}

	private static isValidCookieName(name: string): boolean {
		if (!name || name.length === 0) return false;
		// Простая проверка: буквы, цифры, дефис, подчеркивание
		for (let i = 0; i < name.length; i++) {
			const code = name.charCodeAt(i);
			if (
				!(
					(code >= 0x41 && code <= 0x5a) || // A-Z
					(code >= 0x61 && code <= 0x7a) || // a-z
					(code >= 0x30 && code <= 0x39) || // 0-9
					code === 0x2d ||
					code === 0x5f
				)
			) {
				// - или _
				return false;
			}
		}
		return true;
	}

	private static calculateNetscapeConfidence(line: string): number {
		let partCount = 1;
		let hasTab = false;
		let hasSpace = false;

		// Первый проход: считаем части и проверяем типы разделителей
		for (let i = 0; i < line.length; i++) {
			const char = line.charCodeAt(i);
			if (char === 0x09 || char === 0x20) {
				// таб или пробел
				if (char === 0x09) hasTab = true;
				if (char === 0x20) hasSpace = true;

				// Пропускаем последовательные разделители
				while (i + 1 < line.length && (line.charCodeAt(i + 1) === 0x09 || line.charCodeAt(i + 1) === 0x20)) {
					i++;
				}
				if (i + 1 < line.length) partCount++;
			}
		}

		// Netscape формат: domain includeSubdomains path secure expires name value
		if (partCount < 7) {
			return 0;
		}

		let confidence = 0.2; // базовый за количество полей

		// Бонус за разделители (табы предпочтительнее, но пробелы тоже валидны)
		if (hasTab) {
			confidence += 0.1; // табы - классический Netscape
		} else if (hasSpace) {
			confidence += 0.05; // пробелы - менее типично, но допустимо
		}

		// Простая валидация первых полей для дополнительной уверенности
		let fieldIndex = 0;
		let start = 0;

		for (let i = 0; i <= line.length; i++) {
			const char = i < line.length ? line.charCodeAt(i) : 0;
			if (char === 0x09 || char === 0x20 || i === line.length) {
				// таб, пробел или конец
				if (i > start) {
					const field = line.slice(start, i);

					// Netscape: domain includeSubdomains path secure expires name value
					if (fieldIndex === 0) {
						// Проверяем домен
						if (field.startsWith('.') || (field.includes('.') && field.length > 3)) {
							confidence += 0.3;
						}
					} else if (fieldIndex === 1 || fieldIndex === 3) {
						// Проверяем булевы поля includeSubdomains и secure
						if (field === 'TRUE' || field === 'FALSE' || field === 'true' || field === 'false') {
							confidence += 0.15;
						}
					} else if (fieldIndex === 4) {
						// Проверяем expires (должно быть число)
						if (field.length > 0) {
							let isNumber = true;
							for (let j = 0; j < field.length; j++) {
								const charCode = field.charCodeAt(j);
								if (charCode < 0x30 || charCode > 0x39) {
									// не цифра 0-9
									isNumber = false;
									break;
								}
							}
							if (isNumber) confidence += 0.2;
						}
					} else if (fieldIndex >= 6) {
						// Дошли до name/value - достаточно для валидации
						break;
					}
				}

				// Пропускаем разделители
				while (i + 1 < line.length && (line.charCodeAt(i + 1) === 0x09 || line.charCodeAt(i + 1) === 0x20)) {
					i++;
				}
				start = i + 1;
				fieldIndex++;
			}
		}

		return Math.min(confidence, 1);
	}
}
