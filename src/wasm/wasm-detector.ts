import { CookieFormat } from '../types';
import type { FormatDetectionResult } from '../types';

export class WasmCookieDetector {
	private static wasmModule: WebAssembly.Instance | null = null;
	private static memory: WebAssembly.Memory | null = null;
	private static isInitializing = false;
	private static initPromise: Promise<void> | null = null;

	// Статический encoder для производительности
	private static textEncoder = new TextEncoder();
	private static readonly MAX_WASM_INPUT = 32 * 1024; // (Default 65536 bytes - 64kb)

	// Константы форматов (соответствуют WASM)
	private static readonly FORMAT_UNKNOWN = 0;
	private static readonly FORMAT_JSON = 1;
	private static readonly FORMAT_NETSCAPE = 2;
	private static readonly FORMAT_SETCOOKIE = 3;

	/**
	 * Инициализация WASM модуля
	 */
	static async init(): Promise<void> {
		if (this.wasmModule) return;
		if (this.isInitializing) return this.initPromise!;

		this.isInitializing = true;
		this.initPromise = this.doInit();
		await this.initPromise;
		this.isInitializing = false;
	}

	private static async doInit(): Promise<void> {
		try {
			// Загружаем скомпилированный WASM файл
			const wasmPath = new URL('./wasm-detector.wasm', import.meta.url);
			const wasmBytes = await fetch(wasmPath).then((r) => r.arrayBuffer());

			const wasmModule = await WebAssembly.instantiate(wasmBytes);

			this.wasmModule = wasmModule.instance;
			this.memory = wasmModule.instance.exports.memory as WebAssembly.Memory;

			console.log('🚀 WASM Cookie Detector initialized');
		} catch (error) {
			console.warn('⚠️ WASM Cookie Detector not initialized, fallback:', error);
			this.wasmModule = null;
		}
	}

	/**
	 * Быстрая детекция через WASM
	 */
	static detect(line: string): FormatDetectionResult | null {
		// Fallback к обычному детектору
		if (!this.wasmModule || !this.memory) return null;

		try {
			// Кодируем строку
			const bytes = this.textEncoder.encode(line);
			const memorySize = this.memory.buffer.byteLength;

			// Только если реально не помещается
			// if (bytes.length > memorySize - 1024) {
			// 	return null;
			// }

			// Проверяем что строка помещается в память (оставляем запас в 1KB)
			const memoryView = new Uint8Array(this.memory.buffer);
			memoryView.set(bytes, 0);

			// Вызываем WASM функцию
			const detectFormat = this.wasmModule.exports.detectFormat as (ptr: number, len: number) => number;
			const result = detectFormat(0, bytes.length);

			return this.mapWasmResult(result, line);
		} catch (error) {
			// В production убираем console.warn для производительности
			if (process.env.NODE_ENV === 'development') {
				console.warn('WASM detection failed:', error);
			}
			return null;
		}
	}

	/**
	 * Преобразует результат WASM в TypeScript формат
	 */
	private static mapWasmResult(wasmResult: number, line: string): FormatDetectionResult | null {
		switch (wasmResult) {
			case this.FORMAT_JSON:
				return {
					format: CookieFormat.JSON,
					lines: [line],
				};
			case this.FORMAT_NETSCAPE:
				return {
					format: CookieFormat.NETSCAPE,
					lines: [line],
				};
			case this.FORMAT_SETCOOKIE:
				return {
					format: CookieFormat.SET_COOKIE,
					lines: [line],
				};
			default:
				return null;
		}
	}

	/**
	 * Проверка доступности WASM
	 */
	static isAvailable(): boolean {
		return this.wasmModule !== null;
	}

	/**
	 * Получить информацию о памяти
	 */
	static getMemoryInfo() {
		if (!this.memory) return null;

		return {
			totalBytes: this.memory.buffer.byteLength,
			totalKB: Math.round(this.memory.buffer.byteLength / 1024),
			maxStringSize: this.MAX_WASM_INPUT,
		};
	}
}
