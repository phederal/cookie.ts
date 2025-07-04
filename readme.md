# Cookie Parser

Универсальный парсер cookie для TypeScript/Bun с автоматическим определением формата.

## Особенности

✅ **Поддержка 3 форматов**: Set-Cookie, Netscape, JSON  
✅ **Автоопределение формата** с confidence scoring  
✅ **RFC 6265 совместимость** с строгой валидацией  
✅ **Многострочный JSON** и смешанные форматы  
✅ **TypeScript** с полной типизацией  
✅ **Высокая производительность** для больших файлов

## Установка

```bash
bun add cookie-parser
```

## Быстрый старт

```typescript
import { CookieParser } from 'cookie-parser';

const content = `
sessionid=abc123; Domain=example.com; Path=/; Secure
login.steampowered.com TRUE / FALSE 1782911632 steamRefresh token123
[{"domain":"test.com","name":"uid","value":"456","secure":true}]
`;

const result = CookieParser.parse(content);

console.log(`Найдено ${result.cookies.length} валидных cookie`);
console.log('Статистика:', result.stats);
```

## Поддерживаемые форматы

### 1. Set-Cookie (HTTP заголовки)

```
name=value; Domain=example.com; Path=/; Secure; HttpOnly
expires=Wed, 01-Jul-2026 13:13:52 GMT; Max-Age=31536000
```

### 2. Netscape (файлы cookie)

```
domain.com    TRUE    /    FALSE    1782911632    name    value
#HttpOnly_secure.com    TRUE    /    TRUE    0    session    abc123
```

### 3. JSON

```json
[
  {
    "domain": ".example.com",
    "includeSubdomains": true,
    "path": "/",
    "secure": false,
    "expires": 1782911632,
    "name": "sessionid",
    "value": "token123"
  }
]
```

## API

### CookieParser.parse(content: string)

Основной метод парсинга.

**Параметры:**

- `content` - содержимое файла или строка с cookie

**Возвращает:**

```typescript
{
  cookies: Cookie[];           // Валидные cookie
  errors: string[];           // Ошибки валидации
  stats: {
    total: number;            // Всего найдено
    valid: number;            // Валидных cookie
    formats: {               // Статистика по форматам
      'set-cookie': number;
      'netscape': number;
      'json': number;
    }
  }
}
```

### Типы

```typescript
interface Cookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
  expires?: number; // unix timestamp
  maxAge?: number; // секунды
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  includeSubdomains?: boolean; // для Netscape
}
```

## Примеры использования

### Парсинг файла

```typescript
const fileContent = await Bun.file('./cookies.txt').text();
const result = CookieParser.parse(fileContent);

for (const cookie of result.cookies) {
  console.log(`${cookie.name}=${cookie.value} [${cookie.domain}]`);
}
```

### Обработка ошибок

```typescript
const result = CookieParser.parse(invalidContent);

if (result.errors.length > 0) {
  console.error('Ошибки валидации:');
  result.errors.forEach((error) => console.error(`- ${error}`));
}
```

### Фильтрация по домену

```typescript
const steamCookies = result.cookies.filter((cookie) => cookie.domain.includes('steam'));
```

## Производительность

Для больших файлов используйте оптимизированный парсер:

```typescript
import { PerformanceOptimizer } from 'cookie-parser';

// Потоковая обработка чанками
const result = PerformanceOptimizer.parseStreamOptimized(
  largeContent,
  10000, // размер чанка
);

// Бенчмарк
PerformanceOptimizer.benchmark(testData, 100);
```

**Производительность:** ~50,000+ cookie/сек на современном железе.

## Тестирование

```typescript
import { runTests } from 'cookie-parser';

runTests(); // Запуск встроенных тестов
```

## Валидация

Парсер строго следует RFC 6265:

- ❌ Отклоняет cookie с недопустимыми символами в `name`
- ❌ Проверяет корректность `domain` и `path`
- ❌ Валидирует значения `expires` и `maxAge`
- ✅ Поддерживает URL-кодированные значения

## Лицензия

MIT

## Вклад в проект

1. Fork репозитория
2. Создайте feature branch
3. Добавьте тесты для новой функциональности
4. Создайте Pull Request
