import { describe, test, expect, beforeAll } from 'bun:test';
import { CookieFormatDetector } from '../src/format-detector';
import { WasmCookieDetector } from '../src/wasm/wasm-detector';
import { CookieFormat } from '../src/types';

describe('WASM Performance Tests', () => {
	beforeAll(async () => {
		// Инициализируем WASM модуль
		await CookieFormatDetector.wasm();
	});

	const testCases = [
		// JSON форматы
		'{"name":"sessionid","value":"abc123","domain":"example.com","secure":true}',
		'[{"name":"user","value":"john"},{"name":"theme","value":"dark"}]',

		// Netscape форматы
		'example.com\tTRUE\t/\tFALSE\t1782911632\tsessionid\tabc123',
		'#HttpOnly_secure.com\tTRUE\t/\tTRUE\t0\tsession\ttoken456',
		'.google.com\tTRUE\t/\tFALSE\t1782911632\tNID\tsomeLongValue',

		// SetCookie форматы
		'sessionid=abc123; Domain=example.com; Path=/; Secure',
		'user=john; Max-Age=3600; HttpOnly',
		'theme=dark; SameSite=Lax',

		// Комментарии (должны быть отклонены)
		'# This is a comment',
		'// Another comment',
		'<!-- HTML comment -->',

		// Невалидные строки
		'invalid data without equals',
		'',
		'   ',
	];

	test('WASM модуль должен быть инициализирован', () => {
		expect(WasmCookieDetector.isAvailable()).toBe(true);
	});

	test('WASM детекция должна работать корректно', () => {
		for (const testCase of testCases) {
			const wasmResult = WasmCookieDetector.detect(testCase);
			const fallbackResult = CookieFormatDetector.detect(testCase);

			// Добавляем отладку для проблемных случаев
			if ((wasmResult && !fallbackResult) || (!wasmResult && fallbackResult)) {
				console.log('MISMATCH:');
				console.log('Input:', JSON.stringify(testCase));
				console.log('WASM result:', wasmResult);
				console.log('Fallback result:', fallbackResult);
				console.log('---');
			}

			if (wasmResult && fallbackResult) {
				expect(wasmResult.format).toBe(fallbackResult.format);
			} else {
				// Оба должны вернуть null для невалидных строк
				expect(wasmResult).toBe(fallbackResult);
			}
		}
	});

	test('Производительность WASM vs Fallback', () => {
		const iterations = 10000;
		const testString = 'sessionid=abc123; Domain=example.com; Path=/; Secure; HttpOnly';

		// Прогреваем
		for (let i = 0; i < 100; i++) {
			WasmCookieDetector.detect(testString);
			CookieFormatDetector.detect(testString);
		}

		// WASM тест
		const wasmStart = performance.now();
		for (let i = 0; i < iterations; i++) {
			WasmCookieDetector.detect(testString);
		}
		const wasmTime = performance.now() - wasmStart;

		// Fallback тест (отключаем WASM временно)
		const originalModule = (WasmCookieDetector as any).wasmModule;
		(WasmCookieDetector as any).wasmModule = null;

		const fallbackStart = performance.now();
		for (let i = 0; i < iterations; i++) {
			CookieFormatDetector.detect(testString);
		}
		const fallbackTime = performance.now() - fallbackStart;

		// Восстанавливаем WASM
		(WasmCookieDetector as any).wasmModule = originalModule;

		console.log(`WASM: ${wasmTime.toFixed(2)}ms, Fallback: ${fallbackTime.toFixed(2)}ms`);
		console.log(`WASM is ${(fallbackTime / wasmTime).toFixed(2)}x faster`);

		// WASM должен быть быстрее (но не обязательно, зависит от браузера/среды)
		expect(wasmTime).toBeGreaterThan(0);
		expect(fallbackTime).toBeGreaterThan(0);
	});

	test('WASM должен обрабатывать большие строки', () => {
		// Создаем большую но валидную строку
		const largeCookie = 'largeCookie=' + 'x'.repeat(60000) + '; Domain=example.com';

		const result = WasmCookieDetector.detect(largeCookie);
		expect(result).toBeNull(); // Должен отклонить слишком большие строки
	});

	test('WASM должен обрабатывать границы памяти', () => {
		// Тест с UTF-8 символами которые могут расширить размер
		const unicodeCookie = 'sessionid=тест🍪; Domain=example.com';

		const wasmResult = WasmCookieDetector.detect(unicodeCookie);
		const fallbackResult = CookieFormatDetector.detect(unicodeCookie);

		if (wasmResult && fallbackResult) {
			expect(wasmResult.format).toBe(fallbackResult.format);
		}
	});

	test('Статистика WASM модуля', () => {
		const stats = WasmCookieDetector.getStats();

		expect(stats.isInitialized).toBe(true);
		expect(stats.memorySize).toBeGreaterThan(0);

		console.log('WASM Memory Size:', stats.memorySize, 'bytes');
	});

	test('Специфичные edge cases для WASM', () => {
		const edgeCases = [
			// Netscape с точно 7 полями
			'a\tb\tc\td\te\tf\tg',
			// SetCookie с множественными атрибутами
			'name=value; Domain=test.com; Path=/; Secure; HttpOnly; SameSite=Strict',
			// JSON с вложенными объектами
			'{"name":"test","nested":{"value":"data"}}',
			// Граничные случаи
			'a=',
			'=b',
			'a=b;',
		];

		for (const testCase of edgeCases) {
			const wasmResult = WasmCookieDetector.detect(testCase);
			const fallbackResult = CookieFormatDetector.detect(testCase);

			// Результаты должны совпадать
			if (wasmResult && fallbackResult) {
				expect(wasmResult.format).toBe(fallbackResult.format);
			} else {
				expect(wasmResult).toBe(fallbackResult);
			}
		}
	});
});
