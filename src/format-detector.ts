import { CookieFormat } from './types';
import type { FormatDetectionResult } from './types';

export class CookieFormatDetector {
	static detectFormat(line: string): FormatDetectionResult | null {
		const trimmed = line.trim();

		// Skip empty lines and comments
		if (!trimmed || (trimmed.startsWith('#') && !trimmed.startsWith('#HttpOnly_')) || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
			return null;
		}

		// Быстрая эвристика для определения наиболее вероятного формата
		let bestFormat: CookieFormat;
		let bestConfidence: number;

		// Проверяем в порядке вероятности
		if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
			// Вероятно JSON
			bestConfidence = this.detectJsonFormat(trimmed);
			bestFormat = CookieFormat.JSON;

			// Если JSON уверенно детектирован, не проверяем остальные
			if (bestConfidence >= 0.8) {
				return {
					format: bestFormat,
					confidence: bestConfidence,
					lines: [trimmed],
				};
			}
		} else if (trimmed.includes('=') && !trimmed.includes('\t')) {
			// Вероятно Set-Cookie
			bestConfidence = this.detectSetCookieFormat(trimmed);
			bestFormat = CookieFormat.SET_COOKIE;
		} else {
			// Вероятно Netscape
			bestConfidence = this.detectNetscapeFormat(trimmed);
			bestFormat = CookieFormat.NETSCAPE;
		}

		// Проверяем другие форматы только если текущий не уверен
		if (bestConfidence < 0.8) {
			const jsonConfidence = bestFormat !== CookieFormat.JSON ? this.detectJsonFormat(trimmed) : bestConfidence;
			const setCookieConfidence = bestFormat !== CookieFormat.SET_COOKIE ? this.detectSetCookieFormat(trimmed) : bestConfidence;
			const netscapeConfidence = bestFormat !== CookieFormat.NETSCAPE ? this.detectNetscapeFormat(trimmed) : bestConfidence;

			// Находим лучший без создания массивов
			if (jsonConfidence > bestConfidence) {
				bestConfidence = jsonConfidence;
				bestFormat = CookieFormat.JSON;
			}
			if (setCookieConfidence > bestConfidence) {
				bestConfidence = setCookieConfidence;
				bestFormat = CookieFormat.SET_COOKIE;
			}
			if (netscapeConfidence > bestConfidence) {
				bestConfidence = netscapeConfidence;
				bestFormat = CookieFormat.NETSCAPE;
			}
		}

		if (bestConfidence < 0.7) {
			return null;
		}

		return {
			format: bestFormat,
			confidence: bestConfidence,
			lines: [trimmed],
		};
	}

	private static detectJsonFormat(line: string): number {
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

	private static detectSetCookieFormat(line: string): number {
		// Быстрая проверка на name=value без regex
		const equalIndex = line.indexOf('=');
		if (equalIndex === -1 || equalIndex === 0) {
			return 0;
		}

		// Проверяем что перед = нет пробелов и точек с запятой
		const nameChar = line.charCodeAt(equalIndex - 1);
		if (nameChar === 32 || nameChar === 59) {
			// check space or semicolon
			return 0;
		}

		let confidence = 0.3; // базовый за name=value

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

		confidence += attributeCount * 0.1;

		// Проверка на точку с запятой
		if (line.includes(';')) {
			confidence += 0.2;
		}

		return Math.min(confidence, 1);
	}

	private static detectNetscapeFormat(line: string): number {
		let partCount = 1;
		let hasTab = false;

		for (let i = 0; i < line.length; i++) {
			const char = line.charCodeAt(i);
			if (char === 9 || char === 32) {
				// tab or space
				if (char === 9) hasTab = true;
				// Пропускаем последовательные разделители
				while (i + 1 < line.length && (line.charCodeAt(i + 1) === 9 || line.charCodeAt(i + 1) === 32)) {
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

		// Бонус за табы (характерно для Netscape)
		if (hasTab) {
			confidence += 0.1;
		}

		// Находим части без создания массива
		const parts: string[] = [];
		let start = 0;

		for (let i = 0; i <= line.length; i++) {
			const char = i < line.length ? line.charCodeAt(i) : 0;
			if (char === 9 || char === 32 || i === line.length) {
				// tab, space, or end
				if (i > start) {
					parts.push(line.substring(start, i));
				}
				// Пропускаем разделители
				while (i + 1 < line.length && (line.charCodeAt(i + 1) === 9 || line.charCodeAt(i + 1) === 32)) {
					i++;
				}
				start = i + 1;
			}
		}

		if (parts.length < 7) {
			return 0;
		}

		// Проверяем домен (первое поле) без regex
		const domain = parts[0]!;
		if (domain.startsWith('.') || (domain.includes('.') && domain.length > 3)) {
			// Быстрая проверка: есть точка и достаточная длина
			confidence += 0.3;
		}

		// Проверяем булевы поля без toUpperCase и массивов
		const field1 = parts[1]!;
		if (field1 === 'TRUE' || field1 === 'FALSE' || field1 === 'true' || field1 === 'false') {
			confidence += 0.15;
		}

		const field3 = parts[3]!;
		if (field3 === 'TRUE' || field3 === 'FALSE' || field3 === 'true' || field3 === 'false') {
			confidence += 0.15;
		}

		// Проверяем expires (число) без regex
		const expires = parts[4]!;
		let isNumber = expires.length > 0;
		for (let i = 0; i < expires.length; i++) {
			const char = expires.charCodeAt(i);
			if (char < 48 || char > 57) {
				// не цифра 0-9
				isNumber = false;
				break;
			}
		}

		if (isNumber) {
			confidence += 0.2;
		}

		return Math.min(confidence, 1);
	}
}
