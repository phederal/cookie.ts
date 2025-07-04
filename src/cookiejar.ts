import { Cookie } from './cookie';

export class CookieJar {
	private _cookies: Cookie[];

	constructor(cookies?: Cookie[] | Cookie | CookieJar | CookieJar[]) {
		this._cookies = [];

		if (cookies) {
			if (Array.isArray(cookies)) {
				if (cookies.every((c) => c instanceof Cookie)) {
					cookies.forEach((cookie) => this.add(cookie));
				} else if (cookies.every((c) => c instanceof CookieJar)) {
					cookies.forEach((jar) => jar.cookies.forEach((cookie) => this.add(cookie)));
				}
			} else if (cookies instanceof CookieJar) {
				cookies.cookies.forEach((cookie) => this.add(cookie));
			} else if (cookies instanceof Cookie) {
				this.add(cookies);
			}
		}
	}

	get cookies() {
		return this._cookies.slice(0);
	}

	add(cookie: Cookie | string): void {
		if (typeof cookie == 'string') {
			cookie = Cookie.parse(cookie);
		}

		let cookieObj: Cookie = cookie;

		// If this matches an existing cookie by name and domain, delete that old one
		let matchingCookie = this._cookies.findIndex((c) => c.name == cookieObj.name && c.domain == cookieObj.domain);
		if (matchingCookie != -1) {
			this._cookies.splice(matchingCookie, 1);
		}

		this._cookies.push(cookie);
	}

	remove(cookieName: string, domain: string): boolean {
		let matchingCookie = this._cookies.findIndex((c) => c.name == cookieName && c.domain == domain);
		if (matchingCookie != -1) {
			this._cookies.splice(matchingCookie, 1);
			return true;
		}

		return false;
	}

	stringify(): string {
		return JSON.stringify(this._cookies.map((c: Cookie) => c.stringify()));
	}

	static parse(stringifiedJar: string): CookieJar {
		let jar = new CookieJar();
		JSON.parse(stringifiedJar)
			.map((cookieString: string) => Cookie.parse(cookieString))
			.filter((v: Cookie) => v)
			.forEach((cookie: Cookie) => jar.add(cookie));

		return jar;
	}
}
