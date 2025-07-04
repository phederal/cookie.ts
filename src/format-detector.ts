import { CookieFormat } from './types';
import type { FormatDetectionResult } from './types';

export class CookieFormatDetector {
	static detectFormat(line: string): FormatDetectionResult | null {
		const trimmed = line.trim();

		// Skip empty lines and comments
		if (!trimmed || (trimmed.startsWith('#') && !trimmed.startsWith('#HttpOnly_')) || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
			return null;
		}

		// Проверяем все форматы и выбираем с наивысшим confidence
		const jsonConfidence = this.detectJsonFormat(trimmed);
		const setCookieConfidence = this.detectSetCookieFormat(trimmed);
		const netscapeConfidence = this.detectNetscapeFormat(trimmed);

		const results = [
			{ format: CookieFormat.JSON, confidence: jsonConfidence },
			{ format: CookieFormat.SET_COOKIE, confidence: setCookieConfidence },
			{ format: CookieFormat.NETSCAPE, confidence: netscapeConfidence },
		].filter((r) => r.confidence > 0);

		if (results.length === 0) {
			return null;
		}

		// Берем формат с максимальным confidence
		const best = results.reduce((a, b) => (a.confidence > b.confidence ? a : b));
		if (best.confidence < 0.7) {
			return null;
		}

		return {
			format: best.format,
			confidence: best.confidence,
			lines: [trimmed],
		};
	}

	private static detectJsonFormat(line: string): number {
		// Простая проверка на JSON объект или массив
		if (!(line.startsWith('[') || line.startsWith('{'))) {
			return 0;
		}

		let confidence = 0.3; // базовый за JSON структуру

		const requiredFields = [
			// Required RFC 6265 fields
			'"name":',
			'"value":',
		];

		const importantFields = [
			// Important RFC 6265 fields
			'"domain":',
			'"path":',
			'"expires":',
		];

		const optionalFields = [
			// Optional, RFC 6265
			'"secure":',
			'"maxAge":',
			'"max-age":',
			'"httpOnly":',
			'"httponly":',
			'"SameSite":',
			'"samesite":',

			// Chrome extensions
			'"partitioned":',
			'"priority":',
			'"includeSubdomains":',
			'"includeSubDomains":',
			'"session":',
		];

		const required = requiredFields.filter((field) => line.includes(field));
		const important = importantFields.filter((field) => line.includes(field));
		const optional = optionalFields.filter((field) => line.includes(field));

		// Если найдены все основные поля cookie
		if (required.length === requiredFields.length) {
			confidence += 0.3;
		}

		// Важные поля дают больше уверенности
		confidence += important.length * 0.1;

		// Дополнительные поля
		confidence += optional.length * 0.05;

		return Math.min(confidence, 1);
	}

	private static detectSetCookieFormat(line: string): number {
		// Должно содержать name=value в начале
		if (!/^[^=\s]+=[^;]*/.test(line)) {
			return 0;
		}

		let confidence = 0.3; // базовый за name=value

		// Проверяем наличие атрибутов cookie
		const attributes = ['path=', 'domain=', 'expires=', 'max-age=', 'secure', 'httponly', 'samesite='];
		const foundAttributes = attributes.filter((attr) => line.toLowerCase().includes(attr.toLowerCase()));

		confidence += foundAttributes.length * 0.1;

		// Разделители точка-с-запятой
		if (line.includes(';')) {
			confidence += 0.2;
		}

		return Math.min(confidence, 1);
	}

	private static detectNetscapeFormat(line: string): number {
		// Разделяем по табам и пробелам (любое количество)
		const parts = line.split(/[\t\s]+/).filter((part) => part.length > 0);

		// Netscape формат: domain includeSubdomains path secure expires name value
		if (parts.length < 7) {
			return 0;
		}

		let confidence = 0.2; // базовый за количество полей

		// Проверяем домен (первое поле)
		const domain = parts[0]!;
		if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain) || domain.startsWith('.')) {
			confidence += 0.3;
		}

		// Проверяем булевы поля (includeSubdomains, secure)
		if (['TRUE', 'FALSE'].includes(parts[1]!.toUpperCase())) {
			confidence += 0.15;
		}
		if (['TRUE', 'FALSE'].includes(parts[3]!.toUpperCase())) {
			confidence += 0.15;
		}

		// Проверяем expires (число)
		if (/^\d+$/.test(parts[4]!)) {
			confidence += 0.2;
		}

		return Math.min(confidence, 1);
	}
}
