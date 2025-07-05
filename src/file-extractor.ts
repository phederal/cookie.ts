import { CookieFormatDetector } from './format-detector';
import type { FormatDetectionResult } from './types';

export class FileExtractor {
	static extractCookieLines(fileContent: string): FormatDetectionResult[] {
		const results: FormatDetectionResult[] = [];
		const seenContent = new Set<string>(); // Дедупликация по контенту

		// 1. Ищем однострочные JSON в любом месте текста
		this.extractInlineJson(fileContent, results, seenContent);

		// 2. Ищем многострочные JSON блоки
		this.extractMultilineJson(fileContent, results, seenContent);

		// 3. Ищем Set-Cookie и Netscape форматы построчно
		this.extractLineFormats(fileContent, results, seenContent);

		return results;
	}

	private static extractInlineJson(content: string, results: FormatDetectionResult[], seenContent: Set<string>): void {
		// console.log(
		// 	'Content lines:',
		// 	content.split(/\r?\n/).map((line) => line.trim()),
		// );

		// Ищем JSON объекты и массивы в любом месте текста
		const lines = content.split(/\r?\n/);

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
				this.tryParseJson(trimmed, results, seenContent);
			}
		}
	}

	private static extractMultilineJson(content: string, results: FormatDetectionResult[], seenContent: Set<string>): void {
		const lines = content.split(/\r?\n/);
		let jsonBuffer = '';
		let braceLevel = 0;
		let bracketLevel = 0;
		let inJson = false;
		let inString = false;
		let escaped = false;

		for (const line of lines) {
			for (let i = 0; i < line.length; i++) {
				const char = line[i];

				if (escaped) {
					escaped = false;
					jsonBuffer += char;
					continue;
				}

				if (char === '\\' && inString) {
					escaped = true;
					jsonBuffer += char;
					continue;
				}

				if (char === '"' && !escaped) {
					inString = !inString;
					jsonBuffer += char;
					continue;
				}

				if (inString) {
					jsonBuffer += char;
					continue;
				}

				if (char === '{') {
					if (!inJson) {
						inJson = true;
						jsonBuffer = char;
					} else {
						jsonBuffer += char;
					}
					braceLevel++;
				} else if (char === '[') {
					if (!inJson) {
						inJson = true;
						jsonBuffer = char;
					} else {
						jsonBuffer += char;
					}
					bracketLevel++;
				} else if (char === '}') {
					jsonBuffer += char;
					braceLevel--;
					if (braceLevel === 0 && bracketLevel === 0 && inJson) {
						this.tryParseJson(jsonBuffer, results, seenContent);
						inJson = false;
						jsonBuffer = '';
					}
				} else if (char === ']') {
					jsonBuffer += char;
					bracketLevel--;
					if (braceLevel === 0 && bracketLevel === 0 && inJson) {
						this.tryParseJson(jsonBuffer, results, seenContent);
						inJson = false;
						jsonBuffer = '';
					}
				} else if (inJson) {
					jsonBuffer += char;
				}
			}

			if (inJson) {
				jsonBuffer += '\n';
			}
		}
	}

	private static extractLineFormats(content: string, results: FormatDetectionResult[], seenContent: Set<string>): void {
		const lines = content.split(/\r?\n/);

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;

			// Проверяем дублирование
			if (!seenContent.has(trimmed)) {
				const detection = CookieFormatDetector.detect(trimmed);
				if (detection && (detection.format === 'set-cookie' || detection.format === 'netscape')) {
					seenContent.add(trimmed);
					results.push({
						...detection,
						lines: [trimmed],
					});
				}
			}
		}
	}

	private static tryParseJson(jsonString: string, results: FormatDetectionResult[], seenContent: Set<string>): void {
		try {
			JSON.parse(jsonString);

			// Проверяем дублирование
			if (!seenContent.has(jsonString)) {
				const detection = CookieFormatDetector.detect(jsonString);
				if (detection) {
					seenContent.add(jsonString);
					results.push({
						...detection,
						lines: [jsonString],
					});
				}
			}
		} catch {
			// Не валидный JSON
		}
	}
}
