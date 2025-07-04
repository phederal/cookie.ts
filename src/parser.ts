import { CookieFormat } from './types';
import type { CookieRaw, ParserConfig, ParseResult, ValidationError } from './types';
import { FileExtractor } from './file-extractor';
import { CookieValidator } from './cookie-validator';
import { NetscapeParser } from './parsers/netscape-parser';
import { SetCookieParser } from './parsers/setcookie-parser';
import { JsonParser } from './parsers/json-parser';

export class CookieParser {
	static parse(fileContent: string, config?: ParserConfig) {
		if (!config) config = {};
		if (typeof config.chunk === 'undefined') config.chunk = 50000;

		// Automatically use chunks for large files // >250KB
		if (config.forceChunks || fileContent.length > config.chunk * 5) {
			return this.parseWithChunks(fileContent, config);
		}

		return this.parseHandler(fileContent);
	}

	private static parseHandler(fileContent: string): ParseResult {
		const result: ParseResult = {
			cookies: [],
			errors: [],
			stats: {
				total: 0,
				valid: 0,
				formats: {
					[CookieFormat.SET_COOKIE]: 0,
					[CookieFormat.NETSCAPE]: 0,
					[CookieFormat.JSON]: 0,
				},
			},
		};

		// Извлекаем потенциальные cookie строки
		const detectedLines = FileExtractor.extractCookieLines(fileContent);
		let lineNumber = 0;

		for (const detection of detectedLines) {
			lineNumber++;
			result.stats.total++;

			if (!detection || !detection.lines) continue;

			try {
				const parsedCookies = this.parseByFormat(detection.format, detection.lines[0]!);
				if (parsedCookies) {
					const cookieArray = Array.isArray(parsedCookies) ? parsedCookies : [parsedCookies];

					for (const parsedCookie of cookieArray) {
						const validationErrors = CookieValidator.validate(parsedCookie, lineNumber, detection.lines[0]!);
						if (validationErrors.length === 0) {
							result.cookies.push(parsedCookie as CookieRaw);
							result.stats.valid++;
							result.stats.formats[detection.format]++;
						} else {
							result.errors.push(...validationErrors.map((err) => err.error));
						}
					}
				}
			} catch (error) {
				result.errors.push(`Line ${lineNumber}: Failed to parse - ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}

		return result;
	}

	private static parseWithChunks(content: string, config: ParserConfig): ParseResult {
		const chunks = this.splitChunks(content, config.chunk!);
		const finalResult: ParseResult = {
			cookies: [],
			errors: [],
			stats: {
				total: 0,
				valid: 0,
				formats: {
					[CookieFormat.SET_COOKIE]: 0,
					[CookieFormat.NETSCAPE]: 0,
					[CookieFormat.JSON]: 0,
				},
			},
		};

		let globalLineNumber = 0;

		for (const chunk of chunks) {
			const chunkResult = this.parseHandler(chunk);

			// Корректируем номера строк в ошибках
			const adjustedErrors = chunkResult.errors.map((error) => error.replace(/Line (\d+):/, (_, lineNum) => `Line ${globalLineNumber + parseInt(lineNum)}:`));

			// Объединяем результаты
			finalResult.cookies.push(...chunkResult.cookies);
			finalResult.errors.push(...adjustedErrors);
			finalResult.stats.total += chunkResult.stats.total;
			finalResult.stats.valid += chunkResult.stats.valid;

			// Объединяем статистику форматов
			Object.keys(chunkResult.stats.formats).forEach((format) => {
				finalResult.stats.formats[format as CookieFormat] += chunkResult.stats.formats[format as CookieFormat];
			});

			// Подсчитываем строки в текущем чанке для корректного номера
			globalLineNumber += chunk.split('\n').length;
		}

		return finalResult;
	}

	private static parseByFormat(format: CookieFormat, line: string): Partial<CookieRaw> | Partial<CookieRaw>[] | null {
		switch (format) {
			case CookieFormat.SET_COOKIE:
				return SetCookieParser.parse(line);

			case CookieFormat.NETSCAPE:
				return NetscapeParser.parse(line);

			case CookieFormat.JSON:
				return JsonParser.parse(line);

			default:
				return null;
		}
	}

	private static splitChunks(content: string, chunkSize: number): string[] {
		const chunks: string[] = [];

		for (let i = 0; i < content.length; i += chunkSize) {
			let end = Math.min(i + chunkSize, content.length);

			// Ищем безопасное место для разреза
			if (end < content.length) {
				const separators = ['\n}]', '\n}', '\n];', '\n'];
				let bestEnd = end;

				// Ищем ближайший разделитель в пределах 2KB
				for (const sep of separators) {
					const sepIndex = content.indexOf(sep, end);
					if (sepIndex !== -1 && sepIndex - end < 2000) {
						bestEnd = sepIndex + sep.length;
						break;
					}
				}

				// Если не нашли разделитель, ищем простой перенос строки
				if (bestEnd === end) {
					const nextNewline = content.indexOf('\n', end);
					if (nextNewline !== -1 && nextNewline - end < 1000) {
						bestEnd = nextNewline + 1;
					}
				}

				end = bestEnd;
			}

			chunks.push(content.substring(i, end));
		}

		return chunks;
	}
}
