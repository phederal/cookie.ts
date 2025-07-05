import { CookieFormatDetector } from '../src';

const testCases = [
	// === JSON ТЕСТЫ ===

	// Простые JSON объекты
	'{"name":"test","value":"123","domain":"example.com"}',
	'{"name":"sessionid","value":"abc123","domain":".example.com","path":"/","expires":1234567890,"secure":true,"httpOnly":true}',
	'{"name":"auth","value":"","domain":"site.com","path":"/login","maxAge":3600}',
	'{"name":"csrf","value":"xyz789","domain":"secure.com","secure":true,"sameSite":"Strict"}',
	'{"name":"tracking","value":"user123","domain":".analytics.com","includeSubdomains":true}',

	// JSON массивы
	'[{"name":"test","value":"123","domain":"example.com","secure":true}]',
	'[{"name":"session","value":"abc","domain":"site.com"},{"name":"csrf","value":"xyz","domain":"site.com"}]',
	'[{"name":"cookie1","value":"val1","domain":"example.com","path":"/","httpOnly":true},{"name":"cookie2","value":"val2","domain":"example.com","expires":0}]',

	// JSON с различными форматами полей
	'{"name":"test","value":"123","domain":"example.com","expires":"2024-12-31T23:59:59Z"}',
	'{"name":"pref","value":"dark-mode","domain":"app.com","sameSite":"Lax","priority":"High"}',
	'{"name":"lang","value":"en-US","domain":"i18n.com","partitioned":true}',
	'{"name":"session","value":"token","domain":"api.com","max-age":7200}',
	'{"name":"debug","value":"true","domain":"dev.com","includeSubDomains":false}',

	// Сложные JSON значения
	'{"name":"data","value":"{\\"user\\":\\"john\\",\\"role\\":\\"admin\\"}","domain":"app.com"}',
	'{"name":"config","value":"param1=value1&param2=value2","domain":"service.com"}',
	'{"name":"encoded","value":"hello%20world","domain":"test.com"}',

	// Невалидные JSON (но похожие)
	'{"invalid":"json"}',
	'{"name":"test"}',
	'{"value":"123","domain":"example.com"}',
	'{"name":"","value":"test","domain":"example.com"}',
	'{name:"test",value:"123"}',
	'{"name":"test","value":"123","domain":}',

	// === NETSCAPE ТЕСТЫ ===

	// Стандартный формат с табами
	'example.com\tTRUE\t/\tFALSE\t1234567890\tsessionid\tabc123',
	'.google.com\tTRUE\t/\tTRUE\t0\tauth\ttoken123',
	'api.service.com\tFALSE\t/api\tTRUE\t1782911632\tapi_key\tsk_live_12345',
	'localhost\tFALSE\t/\tFALSE\t0\tdev_session\tlocal_token',

	// HttpOnly префикс
	'#HttpOnly_.secure.com\tTRUE\t/path\tTRUE\t1782911632\tcsrf\txyz789',
	'#HttpOnly_auth.example.com\tTRUE\t/\tTRUE\t0\tsession\tsecure_token',
	'#HttpOnly_admin.site.com\tFALSE\t/admin\tTRUE\t2000000000\tadmin_auth\tadmin_12345',

	// Формат с пробелами вместо табов
	'domain.com TRUE / FALSE 1234567890 name value',
	'site.org FALSE /app TRUE 0 app_session app_token_123',
	'.cdn.com TRUE / FALSE 1640995200 cache_key cache_value_xyz',

	// Смешанные разделители
	'example.com\t  TRUE  \t/\t FALSE\t1234567890\tname\tvalue',
	'site.com    TRUE    /    FALSE    0    session    token',
	'test.org\t\tTRUE\t\t/test\t\tTRUE\t\t1234567890\t\ttest_cookie\t\ttest_value',

	// Различные домены
	'.example.com\tTRUE\t/\tFALSE\t0\tsubdomain_cookie\tvalue',
	'sub.domain.example.com\tFALSE\t/specific\tTRUE\t1234567890\tspecific_cookie\tspecific_value',
	'192.168.1.1\tFALSE\t/\tFALSE\t0\tlocal_ip\tip_cookie',
	'localhost:3000\tFALSE\t/\tFALSE\t0\tdev_port\tport_cookie',

	// Различные пути
	'example.com\tTRUE\t/\tFALSE\t0\troot\troot_value',
	'example.com\tTRUE\t/api/v1\tFALSE\t0\tapi\tapi_value',
	'example.com\tTRUE\t/admin/dashboard\tTRUE\t0\tadmin\tadmin_value',
	'example.com\tTRUE\t/user/profile/settings\tFALSE\t0\tuser_pref\tuser_value',

	// Различные значения expires
	'example.com\tTRUE\t/\tFALSE\t0\tsession\tsession_value',
	'example.com\tTRUE\t/\tFALSE\t1234567890\tpersistent\tpersistent_value',
	'example.com\tTRUE\t/\tFALSE\t2147483647\tmax_expire\tmax_value',
	'example.com\tTRUE\t/\tFALSE\t1\tshort_lived\tshort_value',

	// Сложные значения
	'example.com\tTRUE\t/\tFALSE\t0\tcomplex\tvalue%20with%20spaces',
	'example.com\tTRUE\t/\tFALSE\t0\tjson_cookie\t{"user":"john","id":123}',
	'example.com\tTRUE\t/\tFALSE\t0\turl_params\tparam1=value1&param2=value2',
	'example.com\tTRUE\t/\tFALSE\t0\tbase64\tdGVzdCBzdHJpbmc=',

	// Невалидные Netscape (недостаточно полей)
	'example.com\tTRUE\t/\tFALSE\t0\tincomplete',
	'example.com\tTRUE\t/\tFALSE',
	'example.com\tTRUE\t/',
	'example.com\tTRUE',
	'example.com',

	// === SET-COOKIE ТЕСТЫ ===

	// Простые cookies
	'sessionid=abc123; Domain=example.com; Path=/; Secure',
	'name=value; Domain=.example.com; Path=/; HttpOnly; Secure; SameSite=Strict',
	'simple=cookie',
	'auth=token; Max-Age=3600',
	'user_pref=dark_mode; Domain=app.com; Path=/settings; SameSite=Lax',

	// Без дополнительных атрибутов
	'basic=value',
	'empty=',
	'test=123',
	'long_name=long_value_with_underscores',
	'special-chars=value-with-dashes',

	// Все возможные атрибуты
	'full_cookie=full_value; Domain=.example.com; Path=/; Expires=Wed, 01 Jan 2025 00:00:00 GMT; Max-Age=31536000; Secure; HttpOnly; SameSite=Strict',
	'comprehensive=data; Domain=sub.example.com; Path=/api; Max-Age=7200; Secure; SameSite=None',
	'partitioned_cookie=value; Domain=.example.com; Path=/; Secure; SameSite=None; Partitioned',

	// Различные SameSite значения
	'strict_cookie=value; SameSite=Strict',
	'lax_cookie=value; SameSite=Lax',
	'none_cookie=value; SameSite=None; Secure',

	// Различные форматы Expires
	'expire1=value; Expires=Wed, 01 Jan 2025 00:00:00 GMT',
	'expire2=value; Expires=Sun, 31 Dec 2024 23:59:59 GMT',
	'expire3=value; Expires=Mon, 01 Jan 2024 12:00:00 GMT',

	// Кодированные значения
	'encoded=hello%20world%21; Domain=example.com',
	'special=value%3Bwith%3Dsemicolon; Domain=test.com',
	'json_val=%7B%22user%22%3A%22john%22%7D; Domain=api.com',

	// Различные домены и пути
	'subdomain=value; Domain=.example.com; Path=/',
	'specific=value; Domain=api.example.com; Path=/v1',
	'deep_path=value; Domain=example.com; Path=/very/deep/path/structure',
	'root_domain=value; Domain=example.com',

	// Сложные значения
	'complex_value="quoted string with spaces"; Domain=example.com',
	'data_cookie=user_id:123|session:abc|role:admin; Domain=app.com',
	'base64_data=eyJ1c2VyIjoiam9obiIsInJvbGUiOiJhZG1pbiJ9; Domain=auth.com',

	// Невалидные Set-Cookie (отсутствует =)
	'invalid_no_equals; Domain=example.com',
	'HttpOnly; Secure; SameSite=Strict',
	'Domain=example.com; Path=/',

	// === ГРАНИЧНЫЕ СЛУЧАИ ===

	// Пустые и минимальные
	'',
	' ',
	'=',
	'a=',
	'=b',
	'a=b',

	// Комментарии
	'# This is a comment',
	'// JavaScript comment',
	'/* CSS comment */',
	'<!-- HTML comment -->',
	'# Netscape HTTP Cookie File',
	'# Generated by Netscape on Mon, 01-Jan-2024 00:00:00 GMT',

	// Смешанные форматы (некорректные)
	'name=value\tTRUE\t/\tFALSE\t0',
	'{"name":"test"}\tTRUE\t/',
	'example.com=value; Domain=test.com',

	// Очень длинные строки
	'very_long_cookie_name_that_exceeds_normal_limits=very_long_cookie_value_that_also_exceeds_normal_limits_and_contains_many_characters; Domain=very-long-domain-name-that-exceeds-normal-limits.example.com; Path=/very/long/path/that/exceeds/normal/limits/and/contains/many/segments',

	// Специальные символы
	'special_chars=!@#$%^&*()_+-=[]{}|;:,.<>?; Domain=example.com',
	'unicode_test=тест_значение; Domain=пример.рф',
	'emoji_cookie=🍪🎉✨; Domain=fun.com',

	// Числовые значения
	'number_cookie=12345; Domain=example.com',
	'float_cookie=123.456; Domain=example.com',
	'negative_cookie=-789; Domain=example.com',
	'scientific_cookie=1.23e+10; Domain=example.com',

	// Boolean-подобные значения
	'bool_true=true; Domain=example.com',
	'bool_false=false; Domain=example.com',
	'bool_yes=yes; Domain=example.com',
	'bool_no=no; Domain=example.com',
	'bool_1=1; Domain=example.com',
	'bool_0=0; Domain=example.com',

	// URL-подобные значения
	'url_cookie=https://example.com/path?param=value; Domain=example.com',
	'path_cookie=/api/v1/users/123; Domain=example.com',
	'query_cookie=param1=value1&param2=value2; Domain=example.com',

	// Неопределенные форматы
	'invalid format',
	'no equals but many words here',
	'incomplete\ttab\tformat\tbut\tnot\tenough',
	'almost_json{"name":"test"}',
	'broken_netscape\tTRUE\t/\tFALSE',
	'weird=format=with=many=equals',

	// Множественные cookies в одной строке (некорректно для парсера)
	'cookie1=value1; cookie2=value2; Domain=example.com',
	'session=abc; csrf=xyz; Domain=example.com; Path=/',
];

console.log(`Тестирование ${testCases.length} различных форматов cookies...\n`);

testCases.forEach((test, i) => {
	const result = CookieFormatDetector.detect(test);
	console.log(`Тест ${i + 1}:`);
	console.log(`  Входная строка: "${test}"`);
	console.log(`  Результат: ${result ? `${result.format}` : 'null'}`);
	console.log('');
});

// Статистика по результатам
const stats = {
	total: testCases.length,
	detected: 0,
	json: 0,
	netscape: 0,
	'set-cookie': 0,
	null: 0,
};

await CookieFormatDetector.wasm();

testCases.forEach((test) => {
	const result = CookieFormatDetector.detect(test);

	if (result) {
		stats.detected++;
		if (result.format === 'set-cookie') {
			stats['set-cookie']++;
		} else {
			stats[result.format]++;
		}
	} else {
		stats.null++;
	}
});
(async () => {})();

console.log('\n=== СТАТИСТИКА ===');
console.log(`Всего тестов: ${stats.total}`);
console.log(`Определен формат: ${stats.detected} (${((stats.detected / stats.total) * 100).toFixed(1)}%)`);
console.log(`JSON: ${stats.json}`);
console.log(`Netscape: ${stats.netscape}`);
console.log(`Set-Cookie: ${stats['set-cookie']}`);
console.log(`Не определен: ${stats.null}`);

// Всего тестов: 128
// Определен формат: 92 (71.9%)
// JSON: 16 (должно быть 16)
// Netscape: 29 (должно быть 29)
// Set-Cookie: 47 (должно быть 47)
// Не определен: 36
