/**
 * Some general purpose utility funcitons
 */

import Ph_Toast, { Level } from "../components/misc/toast/toast.js";

/** */
function _numberToShort(num): { n: number, s: string } {
	switch (Math.abs(num).toString().length) {
		case 0:
		case 1:
		case 2:
		case 3:
			return num.toString();
		case 4:
			return { n: floorTo(num / 1000, 2), s: "k"};
		case 5:
		case 6:
			return { n: floorTo(num / 1000, 0), s: "k"};
		case 7:
			return { n: floorTo(num / 1000000, 2), s: "m"};
		case 8:
		case 9:
			return { n: floorTo(num / 1000000, 0), s: "m"};
		case 10:
			return { n: floorTo(num / 1000000000, 2), s: "b"};
		case 11:
		case 12:
			return { n: floorTo(num / 1000000000, 0), s: "b"};
		case 13:
			return { n: floorTo(num / 1000000000000, 2), s: "t"};
		case 14:
		case 15:
			return { n: floorTo(num / 1000000000000, 0), s: "t"};
		default:
			return { n: 0, s: " - ∞" }
	}
}

/** convert long numbers like 11,234 to 11k */
export function numberToShort(num: number): string {
	return Object.values(_numberToShort(num)).join("");
}

/** convert long numbers like 11,234 to 11k */
export function numberToShortStr(num: string): string {
	return numberToShort(parseInt(num));
}


function _timePassedSince(time: number): { n: number, s: string } {
	const s = Math.round(Date.now() / 1000 - time);
	if (s < 60)
		return { n: s, s: "seconds" };
	else if (s < 3600)
		return { n: Math.floor(s / 60), s: "minutes" };
	else if (s < 86400)
		return { n: Math.floor(s / 3600), s: "hours" };
	else if (s < 2592000)
		return { n: Math.floor(s / 86400), s: "days" };
	else if (s < 31557600)
		return { n: Math.floor(s / 2592000), s: "months" };
	else
		return { n: Math.floor(s / 31557600), s: "years" };
}

/**
 * 	1 - 59		 	 1s
 *	60 - 3599	 	 1 - 59m
 *	3600 - 86399	 1 - 23h
 *	86400 - 2591999	 1 - 29d
 *	2592000-31557599 1 - 12mo
 *	1 - ..y
 * @param time in seconds
 */
export function timePassedSince(time: number): string {
	const { n, s } = _timePassedSince(time);
	return `${n.toString()} ${n !== 1 ? s : s.replace(/s$/, "")}`;		// 1 seconds --> 1 second
}

/** @param time in seconds */
export function timePassedSinceStr(time: string): string {
	return timePassedSince(parseInt(time));
}

/** @param time in seconds */
export function timePeriodReadable(time: number) {
	return timePassedSince(Date.now() / 1000 - time);
}

/** splits "/r/all/top?t=day" to ["/r/all/top", "?t=day"] */
export function splitPathQuery(pathAndQuery: string): string[] {
	const querySeparation = pathAndQuery.match(/([^?]+)(\?.*)?/);
	return querySeparation ? [querySeparation[1] || "/", querySeparation[2] || ""] : ["/", ""];
}

/** converts numbers like 69 to "01:09" */
export function secondsToVideoTime(seconds: number): string {
	if (isNaN(seconds)) seconds = 0;
	return `${padWith0(Math.floor(seconds / 60), 2)}:${padWith0(Math.floor(seconds % 60), 2)}`;
}

/** Convert num to string with enough leading 0 to reach the minLength; example: padWith0(9, 2) --> "09" */
export function padWith0(num: number, minLength: number): string {
	return "0".repeat(Math.max(0, minLength - num.toString().length)) + num.toString();
}

export function clamp(val: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, val));
}

/**
 * Returns a function, that, when invoked, will only be triggered at most once
 * during a given window of time. Normally, the throttled function will run
 * as much as it can, without ever going more than once per `wait` duration;
 * but if you'd like to disable the execution on the leading edge, pass
 * `{leading: false}`. To disable execution on the trailing edge, ditto.
 * from https://stackoverflow.com/questions/27078285/simple-throttle-in-js
 */
export function throttle(func: (...any) => any, wait: number, options: { leading?: boolean, trailing?: boolean } = { leading: true, trailing: true}) {
	let context, args, result;
	let timeout = null;
	let previous = 0;
	if (!options) options = {};
	const later = function() {
		previous = options.leading === false ? 0 : Date.now();
		timeout = null;
		result = func.apply(context, args);
		if (!timeout) {
			context = args = null;
		}
	};
	return function(..._: any) {
		const now = Date.now();
		if (!previous && options.leading === false) previous = now;
		const remaining = wait - (now - previous);
		context = this;
		args = arguments;
		if (remaining <= 0 || remaining > wait) {
			if (timeout) {
				clearTimeout(timeout);
				timeout = null;
			}
			previous = now;
			result = func.apply(context, args);
			if (!timeout) context = args = null;
		} else if (!timeout && options.trailing !== false) {
			timeout = setTimeout(later, remaining);
		}
		return result;
	};
}

/** basically does what obj === {} should (but doesn't) do */
export function isObjectEmpty(obj: {}) {
	return Object.keys(obj).length === 0 && obj.constructor === Object;
}

export function deepClone<T>(object: T): T {
	return JSON.parse(JSON.stringify(object));
}

export function isJsonEqual(obj1: object, obj2: object) {
	return JSON.stringify(obj1) === JSON.stringify(obj2);
}

export function roundTo(number: number, precision: number): number {
	return Math.round(number * Math.pow(10, precision)) / Math.pow(10, precision);
}

export function floorTo(number: number, precision: number): number {
	return Math.floor(number * Math.pow(10, precision)) / Math.pow(10, precision);
}

export function ceilTo(number: number, precision: number): number {
	return Math.ceil(number * Math.pow(10, precision)) / Math.pow(10, precision);
}

export function stringSortComparer(s1: string, s2): number {
	return s1.toLowerCase().localeCompare(s2.toLowerCase());
}

/** extracts the path part from an uri; example: "reddit.com/r/all?query" --> "/r/all" */
export function extractPath(uri: string):string {
	const matches = uri.match(/(?<!\/)\/(?!\/)[^?#]*/);
	return matches && matches[0] || "";
}

/** extracts the query part from an uri; example: "reddit.com/r/all?query" --> "?query" */
export function extractQuery(uri: string): string {
	const matches = uri.match(/\?[^#]*/);
	return matches && matches[0] || "";
}

/** extracts the hash part from an uri; example: "/r/AskReddit/wiki/index#wiki_-rule_1-" --> "#wiki_-rule_1-" */
export function extractHash(uri: string): string {
	const matches = uri.match(/#.*$/);
	return matches && matches[0] || "";
}

export function urlWithHttps(url: string) {
	return url.replace(/^http:/, "https:");
}

export async function sleep(ms: number): Promise<void> {
	return  new Promise(resolve => setTimeout(resolve, ms));
}

export function waitForFullScreenExit(): Promise<boolean> {
	return new Promise<boolean>(resolve => {
		if (!document.fullscreenElement) {
			return resolve(false);
		}
		window.addEventListener("fullscreenchange", () => resolve(true), { once: true });
	});
}

const randomStringAlphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export function randomString(length: number): string {
	let randStr = "";
	for (let i = 0; i < length; ++i)
		randStr += randomStringAlphabet[Math.floor(Math.random() * randomStringAlphabet.length)];
	return randStr;
}

export function hasParams(params: IArguments): boolean {
	return params.length > 0;
}

export function hasHTML(elem: Element): boolean {
	return elem.innerHTML !== "";
}

export function getPostIdFromUrl(url: string): string {
	const matches = url?.match(/(?<=\/(r|u|user)\/[^/?#]+\/comments\/)[^/#?]+/);
	return matches ? matches[0] : "";
}

/** Compile time validator that @param name is a property of T */
export const nameOf = <T>(name: keyof T) => name;

/**
 * Creates an element kinda in jsx fashion
 *
 * @param tagName Tag name of the element (div, span, etc.)
 * @param attributes Set of attributes of the element (ex: { "class": "testClass", id: "testId" }
 * @param inner if of type array --> children of this element; else innerText (unless @param useInnerHTML is true)
 * @param useInnerHTML (default false) if true --> string for @param inner will be used for innerHTML
 */
export function makeElement(tagName: string, attributes?: Record<string, string>, inner?: (HTMLElement | HTMLElement[])[] | string, useInnerHTML = false): HTMLElement {
	attributes = attributes || {};
	inner = inner || [];
	const elem = document.createElement(tagName);
	for (const [k, v] of Object.entries(attributes)) {
		elem.setAttribute(k, v);
	}
	if (inner instanceof Array)
		elem.append(...inner.flat().filter(value => Boolean(value)));
	else if (!useInnerHTML)
		elem.innerText = inner;
	else
		elem.innerHTML = inner;
	return elem;
}

interface EditableTimeStrPartDefinition {
	shortStr: string,
	fullStr: string
	ms: number,
	isPreferred: boolean
}

const editableTimeStrParts: EditableTimeStrPartDefinition[] = [
	{
		shortStr: "y",
		fullStr: "year",
		ms: 1000 * 60 * 60 * 24 * 365,
		isPreferred: true
	},
	{
		shortStr: "mo",
		fullStr: "month",
		ms: 1000 * 60 * 60 * 24 * 365 / 12,
		isPreferred: true
	},
	{
		shortStr: "w",
		fullStr: "week",
		ms: 1000 * 60 * 60 * 24 * 7,
		isPreferred: false
	},
	{
		shortStr: "d",
		fullStr: "day",
		ms: 1000 * 60 * 60 * 24,
		isPreferred: true
	},
	{
		shortStr: "h",
		fullStr: "hour",
		ms: 1000 * 60 * 60,
		isPreferred: true
	},
	{
		shortStr: "m",
		fullStr: "minute",
		ms: 1000 * 60,
		isPreferred: true
	},
	{
		shortStr: "s",
		fullStr: "second",
		ms: 1000,
		isPreferred: true
	},
	{
		shortStr: "ms",
		fullStr: "millisecond",
		ms: 1,
		isPreferred: true
	},
];

export function timeMsToEditableTimeStr(timeMs: number): string {
	if (timeMs === 0)
		return "0";

	let out = "";
	let remainingTimeMs = timeMs;
	for (const part of editableTimeStrParts) {
		if (!part.isPreferred)
			continue;
		const partValue = Math.floor(remainingTimeMs / part.ms);
		if (partValue < 1)
			continue;
		out += `${partValue}${part.shortStr}`;
		remainingTimeMs -= partValue * part.ms;
		if (remainingTimeMs <= 0)
			break;
		out += " ";
	}
	return out;
}

export function editableTimeStrToMs(editableStr: string): number {
	try {
		if (editableStr === "0")
			return 0;

		if (!/^\s*(\d+\s*[a-zA-Z]+\s*)+$/.test(editableStr)) {
			throw new Error("Invalid time format (example: 1y 7 months 1day 30s");
		}

		let timeMs = 0;

		const pairs: string[] = editableStr.match(/\d+\s*[a-zA-Z]+/g);
		for (const pair of pairs) {
			const matches = pair.match(/(\d+)\s*([a-zA-Z]+)/);
			const number = parseInt(matches[1]);
			if (!number && number !== 0) {
				throw new Error(`Invalid number ${number}`);
			}
			const timeFrame = matches[2]?.toLowerCase();
			const timeStrPart = editableTimeStrParts.find(value => {
				return timeFrame === value.shortStr || timeFrame.replace(/s?$/, "") === value.fullStr;
			});
			if (!timeStrPart) {
				throw new Error(`Invalid timeframe ${timeFrame}`);
			}

			timeMs += number * timeStrPart.ms;
		}

		return timeMs;
	} catch (e) {
		new Ph_Toast(Level.error, e.message);
		throw e;
	}
}

export function isParamRedditTruthy(param: string, fallback: boolean) {
	if (/^true|1|on|yes$/i.test(param))
		return true;
	else if (/^false|0|off|no$/i.test(param))
		return false;
	else
		return fallback;
}
