// Импорты (в реальном проекте)
// import { CookieParser } from './main-parser.js';
// import { PerformanceOptimizer } from './performance-optimizer.js';

// Моковые классы для демонстрации (замени на реальные импорты)
class MockCookieParser {
	static parse(content: string) {
		// Имитация парсинга
		const lines = content.split('\n').filter((line) => line.trim());
		const cookies = lines.map((line, i) => ({
			name: `cookie${i}`,
			value: `value${i}`,
			domain: 'example.com',
		}));
		return {
			cookies,
			errors: [],
			stats: { total: lines.length, valid: cookies.length, formats: {} },
		};
	}
}

class MockPerformanceOptimizer {
	static parseStreamOptimized(content: string, chunkSize: number = 10000) {
		// Имитация чанкового парсинга
		return MockCookieParser.parse(content);
	}
}

// === ГЕНЕРАЦИЯ ТЕСТОВЫХ ДАННЫХ ===

function generateTestData() {
	console.log('🔧 Генерация тестовых данных...');

	const setCookieTemplate = (i: number) => `cookie${i}=value${i}; Domain=example${i % 10}.com; Path=/; Secure; HttpOnly; expires=1782911632`;

	const netscapeTemplate = (i: number) => `example${i % 10}.com\tTRUE\t/\tTRUE\t1782911632\tcookie${i}\tvalue${i}`;

	const jsonTemplate = (start: number, count: number) => {
		const cookies = [];
		for (let i = start; i < start + count; i++) {
			cookies.push({
				domain: `example${i % 10}.com`,
				includeSubdomains: true,
				path: '/',
				secure: true,
				expires: 1782911632,
				name: `cookie${i}`,
				value: `value${i}`,
			});
		}
		return JSON.stringify(cookies);
	};

	return {
		// Маленький файл (1KB)
		small: Array.from({ length: 50 }, (_, i) => setCookieTemplate(i)).join('\n'),

		// Средний файл (100KB)
		medium: Array.from({ length: 5000 }, (_, i) => netscapeTemplate(i)).join('\n'),

		// Большой файл (1MB)
		large: Array.from({ length: 50000 }, (_, i) => setCookieTemplate(i)).join('\n'),

		// Огромный файл (10MB)
		huge: Array.from({ length: 500000 }, (_, i) => netscapeTemplate(i)).join('\n'),

		// Смешанный формат
		mixed: [...Array.from({ length: 1000 }, (_, i) => setCookieTemplate(i)), jsonTemplate(1000, 500), ...Array.from({ length: 1500 }, (_, i) => netscapeTemplate(i + 1500))].join('\n'),
	};
}

// === ЗАМЕРЫ ПРОИЗВОДИТЕЛЬНОСТИ ===

function measurePerformance(name: string, fn: () => any): { time: number; result: any } {
	const start = performance.now();
	const result = fn();
	const end = performance.now();
	const time = end - start;

	console.log(`⏱️  ${name}: ${time.toFixed(2)}ms`);
	return { time, result };
}

function getMemoryUsage(): number {
	// В Bun используем process.memoryUsage()
	if (typeof process !== 'undefined' && process.memoryUsage) {
		return process.memoryUsage().heapUsed;
	}
	// Fallback для браузера
	return 0;
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// === ОСНОВНЫЕ ТЕСТЫ ===

function runPerformanceTests() {
	console.log('🚀 ЗАПУСК ТЕСТОВ ПРОИЗВОДИТЕЛЬНОСТИ\n');

	const testData = generateTestData();

	// Информация о размерах
	console.log('📊 Размеры тестовых файлов:');
	Object.entries(testData).forEach(([name, data]) => {
		const size = new Blob([data]).size;
		const lines = data.split('\n').length;
		console.log(`  ${name}: ${formatBytes(size)} (${lines.toLocaleString()} строк)`);
	});
	console.log();

	// Тест 1: Сравнение на разных размерах
	console.log('🔄 ТЕСТ 1: Сравнение обычного vs оптимизированного парсера\n');

	Object.entries(testData).forEach(([size, data]) => {
		console.log(`--- ${size.toUpperCase()} FILE ---`);

		const memBefore = getMemoryUsage();

		// Обычный парсер
		const normal = measurePerformance('Обычный парсер', () => MockCookieParser.parse(data));

		// Оптимизированный парсер
		const optimized = measurePerformance('Оптимизированный', () => MockPerformanceOptimizer.parseStreamOptimized(data, getOptimalChunkSize(data.length)));

		const memAfter = getMemoryUsage();
		const memUsed = memAfter - memBefore;

		// Статистика
		const speedup = normal.time / optimized.time;
		const cookiesPerSec = Math.round(normal.result.cookies.length / (normal.time / 1000));
		const optimizedPerSec = Math.round(optimized.result.cookies.length / (optimized.time / 1000));

		console.log(`📈 Результаты:`);
		console.log(`  Найдено cookie: ${normal.result.cookies.length.toLocaleString()}`);
		console.log(`  Ускорение: ${speedup.toFixed(2)}x`);
		console.log(`  Скорость обычного: ${cookiesPerSec.toLocaleString()} cookie/сек`);
		console.log(`  Скорость оптимизированного: ${optimizedPerSec.toLocaleString()} cookie/сек`);
		if (memUsed > 0) {
			console.log(`  Память: ${formatBytes(memUsed)}`);
		}
		console.log();
	});

	// Тест 2: Влияние размера чанка
	console.log('🔧 ТЕСТ 2: Влияние размера чанка\n');

	const largeData = testData.large;
	const chunkSizes = [1000, 5000, 10000, 20000, 50000];

	console.log('Размер чанка | Время (мс) | Cookie/сек');
	console.log('-------------|------------|------------');

	chunkSizes.forEach((chunkSize) => {
		const result = measurePerformance(`Чанк ${chunkSize}`, () => MockPerformanceOptimizer.parseStreamOptimized(largeData, chunkSize));

		const rate = Math.round(result.result.cookies.length / (result.time / 1000));
		console.log(`${chunkSize.toString().padEnd(12)} | ${result.time.toFixed(2).padEnd(10)} | ${rate.toLocaleString()}`);
	});
	console.log();

	// Тест 3: Множественные итерации
	console.log('🔁 ТЕСТ 3: Стабильность производительности (10 итераций)\n');

	const iterations = 10;
	const mediumData = testData.medium;
	const times: number[] = [];

	for (let i = 0; i < iterations; i++) {
		const result = measurePerformance(`Итерация ${i + 1}`, () => MockCookieParser.parse(mediumData));
		times.push(result.time);
	}

	const avgTime = times.reduce((a, b) => a + b) / times.length;
	const minTime = Math.min(...times);
	const maxTime = Math.max(...times);
	const stdDev = Math.sqrt(times.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / times.length);

	console.log(`📊 Статистика по ${iterations} итерациям:`);
	console.log(`  Среднее время: ${avgTime.toFixed(2)}ms`);
	console.log(`  Минимальное: ${minTime.toFixed(2)}ms`);
	console.log(`  Максимальное: ${maxTime.toFixed(2)}ms`);
	console.log(`  Стандартное отклонение: ${stdDev.toFixed(2)}ms`);
	console.log(`  Разброс: ${(((maxTime - minTime) / avgTime) * 100).toFixed(1)}%`);
	console.log();

	// Тест 4: Профилирование памяти
	console.log('💾 ТЕСТ 4: Профилирование памяти\n');

	if (getMemoryUsage() > 0) {
		Object.entries(testData)
			.slice(0, 3)
			.forEach(([size, data]) => {
				const memBefore = getMemoryUsage();

				const result = MockCookieParser.parse(data);

				const memAfter = getMemoryUsage();
				const memUsed = memAfter - memBefore;
				const memPerCookie = memUsed / result.cookies.length;

				console.log(`${size}:`);
				console.log(`  Память: ${formatBytes(memUsed)}`);
				console.log(`  На cookie: ${formatBytes(memPerCookie)}`);
				console.log(`  Cookie: ${result.cookies.length.toLocaleString()}`);
				console.log();
			});
	} else {
		console.log('⚠️  Профилирование памяти недоступно в данной среде');
	}

	console.log('✅ Тесты производительности завершены!');
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

function getOptimalChunkSize(contentSize: number): number {
	if (contentSize < 100_000) return 5_000; // <100KB
	if (contentSize < 1_000_000) return 10_000; // <1MB
	if (contentSize < 10_000_000) return 50_000; // <10MB
	return 100_000; // >10MB
}

// Экспорт для внешнего использования
export { runPerformanceTests, generateTestData, measurePerformance };
