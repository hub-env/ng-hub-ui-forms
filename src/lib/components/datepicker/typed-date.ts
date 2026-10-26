/**
 * Parsing of dates typed by hand into the datepicker's input.
 *
 * The parser is the inverse of what the field displays: it reads the same field order, the same
 * 12/24 hour convention and the same month names the display produces, so whatever the field
 * shows can be typed back. Everything here is pure — no component state — so it can be tested on
 * its own.
 */

import { HubDatepickerGranularity } from '../../interfaces/datepicker.interface';
import { startOfUnit, meridiemLabels } from './time-utils';

/** What the display of a point is made of, in reading order. */
type Field = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second';

/** The display of one point, as the parser needs to see it. */
export interface TypedDateFormat {
	/** BCP-47 locale of the field. */
	locale: string;
	/**
	 * How the field writes a point: an Angular date pattern, or `Intl` options already narrowed to
	 * the granularity. A function cannot be inverted, so the caller passes the options it would
	 * fall back to — the locale's own order.
	 */
	format: Intl.DateTimeFormatOptions | string;
	/** Precision of the point. */
	granularity: HubDatepickerGranularity;
}

/** The shape of a format once reduced to what parsing and hints need. */
interface Layout {
	fields: Field[];
	/** Words that appear literally in the display (`de`, `at`), tolerated when typed. */
	words: string[];
	/** Human hint of the expected input, e.g. `dd/mm/yyyy hh:mm`. */
	hint: string;
}

const TIME_FIELDS: Field[] = ['hour', 'minute', 'second'];

/** Reads the layout of an Angular date pattern. */
function layoutOfPattern(pattern: string): Layout {
	const fields: Field[] = [];
	const words: string[] = [];
	let hint = '';
	const token = /'([^']*)'|(y+|M+|L+|d+|[HhkK]+|m+|s+|[abB]+|E+)|([^'yMLdHhkKmsabBE]+)/g;

	for (const [, quoted, symbol, other] of pattern.matchAll(token)) {
		if (quoted !== undefined) {
			words.push(...(quoted.match(/\p{L}+/gu) ?? []));
			hint += quoted;
		} else if (symbol) {
			const c = symbol[0];

			if (c === 'y') (fields.push('year'), (hint += 'yyyy'));
			else if (c === 'M' || c === 'L') (fields.push('month'), (hint += symbol.length >= 3 ? 'mmm' : 'mm'));
			else if (c === 'd') (fields.push('day'), (hint += 'dd'));
			else if ('HhkK'.includes(c)) (fields.push('hour'), (hint += 'hh'));
			else if (c === 'm') (fields.push('minute'), (hint += 'mm'));
			else if (c === 's') (fields.push('second'), (hint += 'ss'));
			else if (c !== 'E') hint += 'AM/PM';
		} else {
			hint += other;
		}
	}

	return { fields, words, hint: hint.trim() };
}

/** Reads the layout `Intl` gives to the given options in the given locale. */
function layoutOfIntl(locale: string, options: Intl.DateTimeFormatOptions): Layout {
	const fields: Field[] = [];
	const words: string[] = [];
	let hint = '';
	const parts = new Intl.DateTimeFormat(locale, options).formatToParts(new Date(2026, 10, 23, 14, 5, 9));

	for (const { type, value } of parts) {
		switch (type) {
			case 'year':
				fields.push('year');
				hint += 'yyyy';
				break;
			case 'month':
				fields.push('month');
				hint += /\d/.test(value) ? 'mm' : 'mmm';
				break;
			case 'day':
				fields.push('day');
				hint += 'dd';
				break;
			case 'hour':
				fields.push('hour');
				hint += 'hh';
				break;
			case 'minute':
				fields.push('minute');
				hint += 'mm';
				break;
			case 'second':
				fields.push('second');
				hint += 'ss';
				break;
			case 'dayPeriod':
				hint += 'AM/PM';
				break;
			case 'literal':
				words.push(...(value.match(/\p{L}+/gu) ?? []));
				hint += value;
				break;
		}
	}

	return { fields, words, hint: hint.trim() };
}

function layoutOf({ locale, format }: TypedDateFormat): Layout {
	return typeof format === 'string' ? layoutOfPattern(format) : layoutOfIntl(locale, format);
}

/** Lowercase, accent-free form used to compare words. */
function fold(value: string): string {
	return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Month names (short and long, standalone and in-date) of the locale, folded, mapped to 0–11. */
function monthNames(locale: string): Map<string, number> {
	const names = new Map<string, number>();

	for (const width of ['short', 'long'] as const) {
		for (const withDay of [false, true]) {
			const formatter = new Intl.DateTimeFormat(locale, withDay ? { day: 'numeric', month: width } : { month: width });

			for (let month = 0; month < 12; month++) {
				const name = formatter.formatToParts(new Date(2026, month, 15)).find((p) => p.type === 'month')?.value;

				if (name) names.set(fold(name).replace(/\p{P}/gu, ''), month);
			}
		}
	}

	return names;
}

/** Maps the locale's own digits (Arabic-Indic and the like) to ASCII so they can be typed back. */
function normalizeDigits(text: string, locale: string): string {
	const digits = new Intl.NumberFormat(locale, { useGrouping: false });

	return text.replace(/\p{Nd}/gu, (char) => {
		for (let d = 0; d < 10; d++) {
			if (digits.format(d) === char) return `${d}`;
		}

		return char;
	});
}

/** Finds and removes an AM/PM marker. Returns the remaining text and which period it named. */
function takeMeridiem(text: string, locale: string): { rest: string; pm: boolean | null } {
	const [am, pm] = meridiemLabels(locale);
	const candidates: [string, boolean][] = [
		[am, false],
		[pm, true],
		['am', false],
		['pm', true]
	];

	for (const [label, isPm] of candidates) {
		const letters = [...label.replace(/[^\p{L}]/gu, '')].join('[\\s.]*');

		if (!letters) continue;

		const found = new RegExp(`(?<!\\p{L})${letters}\\.?(?!\\p{L})`, 'iu').exec(text);

		if (found) {
			return { rest: `${text.slice(0, found.index)} ${text.slice(found.index + found[0].length)}`, pm: isPm };
		}
	}

	return { rest: text, pm: null };
}

/** The fields read from a text, plus the day period if one was typed. */
interface Scanned {
	values: Partial<Record<Field, number>>;
}

/**
 * Reads the typed text field by field, in the order of `fields`.
 *
 * Month may arrive as a name instead of a number, which takes the month out of the numeric run;
 * leftover words must be month names, an AM/PM marker, or words the display itself contains.
 * Missing trailing time fields are tolerated (a date typed into a date-time field means midnight).
 */
function scan(text: string, locale: string, layout: Layout, fields: Field[]): Scanned | null {
	const { rest, pm } = takeMeridiem(normalizeDigits(text, locale), locale);
	const tokens = rest.match(/\p{L}+|\d+/gu) ?? [];
	const names = monthNames(locale);
	const allowed = new Set(layout.words.map(fold));
	const numbers: string[] = [];
	let namedMonth: number | null = null;

	for (const token of tokens) {
		if (/\d/.test(token)) {
			numbers.push(token);
		} else if (names.has(fold(token)) && namedMonth === null) {
			namedMonth = names.get(fold(token))!;
		} else if (!allowed.has(fold(token))) {
			return null;
		}
	}

	const slots = namedMonth === null ? fields : fields.filter((f) => f !== 'month');
	const values: Partial<Record<Field, number>> = {};

	if (namedMonth !== null) {
		if (!fields.includes('month')) return null;
		values.month = namedMonth;
	}

	if (numbers.length > slots.length) return null;

	slots.forEach((field, i) => {
		if (i < numbers.length) {
			values[field] = Number(numbers[i]);
		}
	});

	if (slots.slice(numbers.length).some((f) => !TIME_FIELDS.includes(f))) return null;

	if (values.year !== undefined) {
		const raw = numbers[slots.indexOf('year')];

		if (raw.length <= 2) values.year = 2000 + values.year;
	}

	if (values.month !== undefined && namedMonth === null) values.month -= 1;

	// Engines that write midnight as 24:05 with a 24-hour clock must be able to read it back.
	if (pm === null && values.hour === 24) values.hour = 0;

	if (pm !== null) {
		if (values.hour === undefined || values.hour < 1 || values.hour > 12) return null;
		values.hour = (values.hour % 12) + (pm ? 12 : 0);
	}

	return { values };
}

/**
 * Builds a local `Date` from parsed fields and proves it round-trips, so 31/02 or 25:00 are
 * rejected instead of rolling over into another date.
 */
function build(values: Scanned['values'], base?: Date): Date | null {
	const year = values.year ?? base?.getFullYear();

	if (year === undefined) return null;

	const month = values.month ?? base?.getMonth() ?? 0;
	const day = values.day ?? base?.getDate() ?? 1;
	const [hour, minute, second] = [values.hour ?? 0, values.minute ?? 0, values.second ?? 0];
	const date = new Date(2000, 0, 1, 0, 0, 0);

	date.setFullYear(year, month, day);
	date.setHours(hour, minute, second, 0);

	const exact =
		date.getFullYear() === year &&
		date.getMonth() === month &&
		date.getDate() === day &&
		date.getHours() === hour &&
		date.getMinutes() === minute &&
		date.getSeconds() === second;

	return exact ? date : null;
}

/**
 * Parses one typed point (a date, or a date with time) as the field would display it.
 *
 * @param text - What the user typed.
 * @param spec - How the field displays a point.
 * @returns The date truncated to the granularity, or `null` when the text is not a valid date.
 */
export function parseTypedDate(text: string, spec: TypedDateFormat): Date | null {
	const layout = layoutOf(spec);
	const scanned = scan(text, spec.locale, layout, layout.fields);

	if (!scanned || scanned.values.year === undefined) return null;

	const date = build(scanned.values);

	return date ? startOfUnit(date, spec.granularity) : null;
}

/**
 * Parses a time of day typed on its own, placed on the day of `base`. This is the trailing end
 * of a `day-time-range`, which the field shows as the time alone.
 *
 * @param text - What the user typed after the separator.
 * @param spec - How the field displays a point.
 * @param base - The date whose calendar day is kept.
 * @returns The date, or `null` when the text is not a valid time.
 */
export function parseTypedTime(text: string, spec: TypedDateFormat, base: Date): Date | null {
	const layout = layoutOf(spec);
	const scanned = scan(
		text,
		spec.locale,
		layout,
		layout.fields.filter((f) => TIME_FIELDS.includes(f))
	);

	if (!scanned || scanned.values.hour === undefined) return null;

	const date = build(scanned.values, base);

	return date ? startOfUnit(date, spec.granularity) : null;
}

/**
 * Human hint of what the field expects, for the parse error (`dd/mm/yyyy`, `dd/mm/yyyy hh:mm`).
 *
 * @param spec - How the field displays a point.
 * @returns The hint, derived from the same layout the parser reads.
 */
export function typedDateHint(spec: TypedDateFormat): string {
	return layoutOf(spec).hint;
}
