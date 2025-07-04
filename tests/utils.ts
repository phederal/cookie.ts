import { CookieFormat } from '../src/types';

export class TestData {
	private static domains = [
		'example.com',
		'test.org',
		'demo.net',
		'domain.io',
		'app.dev',
		'github.com',
		'youtube.com',
		'google.com',
		'facebook.com',
		'twitter.com',
		'instagram.com',
		'linkedin.com',
		'pinterest.com',
		'reddit.com',
		'tiktok.com',
		'snapchat.com',
		'yahoo.com',
		'microsoft.com',
		'amazon.com',
	];
	private static paths = ['/', '/app', '/user', '/api', '/admin', '/api/v1', '/api/v2', '/api/v3', '/api/v4', '/api/v5', '/api/v6', '/api/v7', '/api/v8', '/api/v9', '/api/v10', '/api/v11', '/api/v12', '/api/v13', '/api/v14', '/api/v15'];
	private static sameSites = ['Strict', 'Lax', 'None'];

	static create(count: number = 1, format: keyof typeof CookieFormat | 'MIXED' = 'MIXED'): string {
		const results: string[] = [];

		switch (format) {
			case 'SET_COOKIE':
				for (let i = 0; i < count; i++) {
					results.push(this.generateSetCookie(i));
				}
				break;

			case 'NETSCAPE':
				for (let i = 0; i < count; i++) {
					results.push(this.generateNetscape(i));
				}
				break;

			case 'JSON':
				// JSON как массив всех cookie
				const jsonCookies = [];
				for (let i = 0; i < count; i++) {
					jsonCookies.push(this.generateJsonCookie(i));
				}
				results.push(JSON.stringify(jsonCookies));
				break;

			case 'MIXED' as string:
				// Смешиваем все форматы
				for (let i = 0; i < count; i++) {
					const formatIndex = i % 3;
					if (formatIndex === 0) {
						console.log('MIXED_SET_COOKIE', i);
						results.push(this.generateSetCookie(i));
					} else if (formatIndex === 1) {
						console.log('MIXED_NETSCAPE', i);
						results.push(this.generateNetscape(i));
					} else {
						console.log('MIXED_JSON', i);
						results.push(JSON.stringify([this.generateJsonCookie(i)]));
					}
				}
				break;
		}

		return results.join('\n');
	}

	private static generateSetCookie(index: number): string {
		const domains = this.domains;
		const paths = this.paths;
		const sameSites = this.sameSites;

		const domain = domains[index % domains.length] + index.toString();
		const path = paths[index % paths.length];
		const sameSite = sameSites[index % sameSites.length];
		const expires = 1782911632 + index * 3600; // +1 hour each
		const secure = index % 2 === 0;
		const httpOnly = index % 3 === 0;

		let cookie = `cookie_${index}=value_${index}_${Math.random().toString(36).substring(7)}`;
		cookie += `; Domain=${domain}`;
		cookie += `; Path=${path}`;
		cookie += `; expires=Wed, 01-Jul-${2026 + Math.floor(index / 100)} 13:13:52 GMT`;
		cookie += `; Max-Age=${3600 + index * 60}`;

		if (secure) cookie += '; Secure';
		if (httpOnly) cookie += '; HttpOnly';
		cookie += `; SameSite=${sameSite}`;

		return cookie;
	}

	private static generateNetscape(index: number): string {
		const domains = this.domains;
		const paths = this.paths;

		const domain = domains[index % domains.length];
		const path = paths[index % paths.length];
		const includeSubdomains = index % 2 === 0 ? 'TRUE' : 'FALSE';
		const secure = index % 3 === 0 ? 'TRUE' : 'FALSE';
		const expires = 1782911632 + index * 3600;
		const httpOnly = index % 4 === 0;

		const prefix = httpOnly ? '#HttpOnly_' : '';

		return `${prefix}${domain}\t${includeSubdomains}\t${path}\t${secure}\t${expires}\tcookie_${index}\tvalue_${index}_${Math.random().toString(36).substring(7)}`;
	}

	private static generateJsonCookie(index: number): object {
		const domains = this.domains;
		const paths = this.paths;

		return {
			domain: `.${domains[index % domains.length]}`,
			path: paths[index % paths.length],
			secure: index % 3 === 0,
			expires: 1782911632 + index * 3600,
			name: `cookie_${index}`,
			value: `value_${index}_${Math.random().toString(36).substring(7)}`,
		};
	}
}
