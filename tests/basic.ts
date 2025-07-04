import { CookieParser } from '../src/parser';
import { CookieFormat } from '../src/types';

// Тестовые данные из твоих примеров
const testData = {
	setCookie: `steamRefresh_steam=76561110101010101%7C%7CeyAidHlwIjogIkpXVCIsICJhbGciOiAiRWREU0EiIH0.eyA*****9.Q*****c-6*****q-o*****; expires=Wed, 01-Jul-2026 13:13:52 GMT; Max-Age=31536000; path=/; secure; HttpOnly; SameSite=None; Domain=login.steampowered.com
ak_bmsc=F0CBFFF4B3C32FCC6404C2BB452DA880~000000000000000000000000000000~Y*****y/rw*****X/Cx/N*****3/g*****Q/+I/d*****o/3*****i+v*****L+Z*****D/4v+tZ*****s+/K*****k; Domain=.steampowered.com; Path=/; Expires=Tue, 01 Jul 2025 15:13:52 GMT; Max-Age=7200`,

	netscape: `login.steampowered.com  TRUE  / FALSE 1782911632  steamRefresh_steam  76561110101010101||eyAidHlwIjogIkpXVCIsICJhbGciOiAiRWREU0EiIH0.eyA*****9.Q*****c-6*****q-o*****
.steampowered.com TRUE  / TRUE  1751578432  ak_bmsc F0CBFFF4B3C32FCC6404C2BB452DA880~000000000000000000000000000000~Y*****y/rw*****X/Cx/N*****3/g*****Q/+I/d*****o/3*****i+v*****L+Z*****D/4v+tZ*****s+/K*****k
#HttpOnly_help.steampowered.com TRUE  / TRUE  0 steamCountry  NL%7C5e7213f10dd90be238e66e3d5c53d8b7`,

	json: `[{"domain":".login.steampowered.com","includeSubdomains":true,"path":"/","secure":false,"expires":1782911632,"name":"steamRefresh_steam","value":"76561110101010101||eyAidHlwIjogIkpXVCIsICJhbGciOiAiRWREU0EiIH0.eyA*****9.Q*****c-6*****q-o*****"},{"domain":".steampowered.com","includeSubdomains":true,"path":"/","secure":true,"expires":1751578432,"name":"ak_bmsc","value":"F0CBFFF4B3C32FCC6404C2BB452DA880~000000000000000000000000000000~Y*****y/rw*****X/Cx/N*****3/g*****Q/+I/d*****o/3*****i+v*****L+Z*****D/4v+tZ*****s+/K*****k"}]`,

	mixed: `Вот мои куки:
login.steampowered.com  TRUE  / FALSE 1782911632  steamRefresh_steam  76561110101010101||token

И еще JSON формат:
[{"domain":"example.com","includeSubdomains":true,"path":"/","secure":true,"expires":0,"name":"sessionid","value":"abc123"}]

А это Set-Cookie:
test=value; Domain=example.com; Path=/; Secure`,
};

function runTests() {
	console.log('🧪 Running Cookie Parser Tests...\n');

	// Тест 1: Set-Cookie формат
	console.log('📝 Test 1: Set-Cookie Format');
	const setCookieResult = CookieParser.parse(testData.setCookie);
	console.log(`Cookies found: ${setCookieResult.cookies.length}`);
	console.log(`Valid cookies: ${setCookieResult.stats.valid}`);
	console.log(`Set-Cookie format: ${setCookieResult.stats.formats[CookieFormat.SET_COOKIE]}`);
	console.log(`Errors: ${setCookieResult.errors.length}\n`);

	// Тест 2: Netscape формат
	console.log('📝 Test 2: Netscape Format');
	const netscapeResult = CookieParser.parse(testData.netscape);
	console.log(`Cookies found: ${netscapeResult.cookies.length}`);
	console.log(`Valid cookies: ${netscapeResult.stats.valid}`);
	console.log(`Netscape format: ${netscapeResult.stats.formats[CookieFormat.NETSCAPE]}`);
	console.log(`Errors: ${netscapeResult.errors.length}\n`);

	// Тест 3: JSON формат
	console.log('📝 Test 3: JSON Format');
	const jsonResult = CookieParser.parse(testData.json);
	console.log(`Cookies found: ${jsonResult.cookies.length}`);
	console.log(`Valid cookies: ${jsonResult.stats.valid}`);
	console.log(`JSON format: ${jsonResult.stats.formats[CookieFormat.JSON]}`);
	console.log(`Errors: ${jsonResult.errors.length}\n`);

	// Тест 4: Смешанный формат
	console.log('📝 Test 4: Mixed Formats');
	const mixedResult = CookieParser.parse(testData.mixed);
	console.log(`Cookies found: ${mixedResult.cookies.length}`);
	console.log(`Valid cookies: ${mixedResult.stats.valid}`);
	console.log(`Formats breakdown:`, mixedResult.stats.formats);
	console.log(`Errors: ${mixedResult.errors.length}\n`);

	// Тест 5: Производительность
	console.log('⚡ Test 5: Performance');
	const largeData = testData.netscape.repeat(1000); // 3000 строк
	const startTime = performance.now();
	const perfResult = CookieParser.parse(largeData);
	const endTime = performance.now();
	console.log(`Parsed ${perfResult.cookies.length} cookies in ${(endTime - startTime).toFixed(2)}ms`);
	console.log(`Rate: ${((perfResult.cookies.length / (endTime - startTime)) * 1000).toFixed(0)} cookies/sec\n`);

	// Вывод примеров cookie
	if (setCookieResult.cookies.length > 0) {
		console.log('🍪 Example Cookie (Set-Cookie):');
		console.log(JSON.stringify(setCookieResult.cookies[0], null, 2));
	}
}

// Экспорт для использования
export { runTests, testData };
