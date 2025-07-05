#!/bin/bash
echo "🔨 Компиляция WASM модуля..."
wat2wasm src/wasm/wasm-detector.wat -o src/wasm/wasm-detector.wasm
echo "✅ WASM модуль скомпилирован: src/wasm/wasm-detector.wasm"
