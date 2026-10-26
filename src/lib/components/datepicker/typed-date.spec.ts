import { TypedDateFormat, parseTypedDate, parseTypedTime, typedDateHint } from './typed-date';

/**
 * The parser is the inverse of what the field displays, so what a person reads in the input can
 * be typed back. Every test pins its locale: the field order of a locale-derived format comes from
 * `Intl`, and a result that depended on the machine would pass on one laptop and fail in CI.
 */

const spec = (
	locale: string,
	format: TypedDateFormat['format'],
	granularity: TypedDateFormat['granularity'] = 'day'
): TypedDateFormat => ({
	locale,
	format,
	granularity
});

const numeric: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };

describe('parseTypedDate', () => {
	describe('Angular patterns', () => {
		it('reads dd/MM/yyyy', () => {
			expect(parseTypedDate('20/06/2026', spec('en-US', 'dd/MM/yyyy'))).toEqual(new Date(2026, 5, 20));
		});

		it('reads dd/MM/yyyy HH:mm', () => {
			expect(parseTypedDate('20/06/2026 14:35', spec('en-US', 'dd/MM/yyyy HH:mm', 'minute'))).toEqual(
				new Date(2026, 5, 20, 14, 35)
			);
		});

		it('accepts a date alone in a date-time pattern as midnight', () => {
			expect(parseTypedDate('20/06/2026', spec('en-US', 'dd/MM/yyyy HH:mm', 'minute'))).toEqual(
				new Date(2026, 5, 20, 0, 0)
			);
		});
	});

	describe('Intl-derived order', () => {
		it('puts the month first in en-US', () => {
			expect(parseTypedDate('06/03/2026', spec('en-US', numeric))).toEqual(new Date(2026, 5, 3));
		});

		it.each(['es-ES', 'en-GB'])('puts the day first in %s', (locale) => {
			expect(parseTypedDate('06/03/2026', spec(locale, numeric))).toEqual(new Date(2026, 2, 6));
		});
	});

	describe('lenient input', () => {
		it.each(['20/06/2026', '20-06-2026', '20.06.2026', '20 06 2026'])('accepts any non-digit separator: %s', (text) => {
			expect(parseTypedDate(text, spec('es-ES', numeric))).toEqual(new Date(2026, 5, 20));
		});

		it('expands a 2-digit year to 20yy', () => {
			expect(parseTypedDate('20/06/26', spec('es-ES', numeric))).toEqual(new Date(2026, 5, 20));
		});

		it('reads short month names', () => {
			const format: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };

			expect(parseTypedDate('Jun 20, 2026', spec('en-US', format))).toEqual(new Date(2026, 5, 20));
		});

		it('reads long month names, with or without accents', () => {
			const format: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };

			expect(parseTypedDate('20 de junio de 2026', spec('es-ES', format))).toEqual(new Date(2026, 5, 20));
			expect(parseTypedDate('1 de septiembre de 2026', spec('es-ES', format))).toEqual(new Date(2026, 8, 1));
		});

		it('rejects unknown words', () => {
			expect(parseTypedDate('20 foo 2026', spec('en-US', numeric))).toBeNull();
		});
	});

	describe('invalid dates', () => {
		it('rejects 31/02 instead of rolling over', () => {
			expect(parseTypedDate('31/02/2026', spec('es-ES', numeric))).toBeNull();
		});

		it('rejects an out-of-range month and hour', () => {
			expect(parseTypedDate('10/13/2026', spec('es-ES', numeric))).toBeNull();
			expect(parseTypedDate('20/06/2026 25:00', spec('en-US', 'dd/MM/yyyy HH:mm', 'minute'))).toBeNull();
		});

		it('rejects text without a year, empty text and extra numbers', () => {
			expect(parseTypedDate('20/06', spec('es-ES', numeric))).toBeNull();
			expect(parseTypedDate('', spec('es-ES', numeric))).toBeNull();
			expect(parseTypedDate('20/06/2026/1', spec('es-ES', numeric))).toBeNull();
		});
	});

	describe('granularity', () => {
		it('truncates to the year', () => {
			expect(parseTypedDate('2026', spec('en-US', { year: 'numeric' }, 'year'))).toEqual(new Date(2026, 0, 1));
		});

		it('reads a month granularity', () => {
			expect(parseTypedDate('06/2026', spec('en-US', { year: 'numeric', month: '2-digit' }, 'month'))).toEqual(
				new Date(2026, 5, 1)
			);
		});

		it('reads a day granularity', () => {
			expect(parseTypedDate('20/06/2026', spec('es-ES', numeric, 'day'))).toEqual(new Date(2026, 5, 20));
		});

		it('truncates seconds typed at minute granularity', () => {
			expect(parseTypedDate('20/06/2026 14:35:50', spec('en-US', 'dd/MM/yyyy HH:mm:ss', 'minute'))).toEqual(
				new Date(2026, 5, 20, 14, 35)
			);
		});
	});

	describe('12-hour clock', () => {
		const format: Intl.DateTimeFormatOptions = { ...numeric, hour: '2-digit', minute: '2-digit', hour12: true };
		const s = spec('en-US', format, 'minute');

		it('reads PM', () => {
			expect(parseTypedDate('06/20/2026, 02:35 PM', s)).toEqual(new Date(2026, 5, 20, 14, 35));
		});

		it('reads 12 AM as midnight and 12 PM as noon', () => {
			expect(parseTypedDate('06/20/2026, 12:05 AM', s)).toEqual(new Date(2026, 5, 20, 0, 5));
			expect(parseTypedDate('06/20/2026, 12:05 PM', s)).toEqual(new Date(2026, 5, 20, 12, 5));
		});

		it('rejects an hour over 12 next to a marker', () => {
			expect(parseTypedDate('06/20/2026, 13:05 PM', s)).toBeNull();
		});
	});
});

describe('parseTypedTime', () => {
	const s = spec('en-GB', 'dd/MM/yyyy HH:mm', 'minute');

	it('places a bare time on the day of the base', () => {
		expect(parseTypedTime('18:30', s, new Date(2026, 5, 20))).toEqual(new Date(2026, 5, 20, 18, 30));
	});

	it('rejects text that is not a time', () => {
		expect(parseTypedTime('soon', s, new Date(2026, 5, 20))).toBeNull();
		expect(parseTypedTime('25:00', s, new Date(2026, 5, 20))).toBeNull();
	});
});

describe('typedDateHint', () => {
	it('describes an Angular pattern', () => {
		expect(typedDateHint(spec('en-US', 'dd/MM/yyyy'))).toBe('dd/mm/yyyy');
		expect(typedDateHint(spec('en-US', 'dd/MM/yyyy HH:mm', 'minute'))).toBe('dd/mm/yyyy hh:mm');
	});

	it('follows the order of the locale', () => {
		expect(typedDateHint(spec('en-US', numeric))).toBe('mm/dd/yyyy');
		expect(typedDateHint(spec('en-GB', numeric))).toBe('dd/mm/yyyy');
	});
});
