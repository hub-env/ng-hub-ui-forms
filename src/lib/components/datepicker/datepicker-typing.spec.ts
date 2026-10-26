import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { vi } from 'vitest';
import { HubDatepickerMode } from '../../interfaces/datepicker.interface';
import { provideHubForms } from '../../services/forms-config';
import { defaultInvalidFeedback } from '../../shared/hub-error-display';
import { HubDatepickerComponent } from './datepicker.component';

/**
 * Typing a date by hand: the text commits on blur and Enter, bad text keeps what was typed but
 * empties the value, and bounds judge typed and programmatic values alike. The locale is pinned
 * to en-GB (day first) so the typed strings mean the same on every machine.
 */

@Component({
	standalone: true,
	imports: [HubDatepickerComponent, ReactiveFormsModule],
	template: `
		<hub-datepicker
			[formControl]="ctrl"
			[mode]="mode()"
			[typeable]="typeable()"
			[min]="min()"
			[max]="max()"
			locale="en-GB"
			label="Date"
		/>
	`
})
class TypingHostComponent {
	readonly ctrl = new FormControl<unknown>(null);
	readonly mode = signal<HubDatepickerMode>('single');
	readonly typeable = signal(true);
	readonly min = signal<string | Date | null>(null);
	readonly max = signal<string | Date | null>(null);
}

describe('HubDatepickerComponent typing', () => {
	let fixture: ComponentFixture<TypingHostComponent>;
	let host: TypingHostComponent;

	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date(2026, 5, 15));

		TestBed.configureTestingModule({
			imports: [TypingHostComponent, NoopAnimationsModule],
			providers: [provideHubForms()]
		});

		fixture = TestBed.createComponent(TypingHostComponent);
		host = fixture.componentInstance;
		fixture.detectChanges();
	});

	afterEach(() => {
		vi.useRealTimers();
		document.querySelectorAll('.hub-overlay-container, .hub-overlay-backdrop').forEach((el) => el.remove());
	});

	const input = () => fixture.debugElement.query(By.css('.hub-datepicker__input')).nativeElement as HTMLInputElement;
	const messages = () =>
		fixture.debugElement
			.queryAll(By.css('.hub-field__feedback-text'))
			.map((e) => (e.nativeElement as HTMLElement).textContent!.trim());

	function type(text: string): void {
		input().value = text;
		input().dispatchEvent(new Event('input'));
	}

	function enter(): void {
		input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		fixture.detectChanges();
	}

	function blur(): void {
		input().dispatchEvent(new Event('blur'));
		fixture.detectChanges();
	}

	describe('committing', () => {
		it('commits on Enter with the serialized value and the formatted text', () => {
			type('20/06/2026');
			enter();

			expect(host.ctrl.value).toBe('2026-06-20');
			expect(input().value).toBe('20/06/2026');
		});

		it('commits on blur', () => {
			type('5-7-26');
			blur();

			expect(host.ctrl.value).toBe('2026-07-05');
			expect(input().value).toBe('05/07/2026');
		});

		it('clears the value when the text is emptied', () => {
			host.ctrl.setValue('2026-06-20');
			fixture.detectChanges();
			type('');
			blur();

			expect(host.ctrl.value).toBeNull();
		});
	});

	describe('bad text', () => {
		beforeEach(() => {
			host.ctrl.addValidators((c) => (c.value == null ? { required: true } : null));
			type('31/02/2026');
			blur();
			host.ctrl.markAsTouched();
			fixture.detectChanges();
		});

		it('keeps the text, nulls the value and raises the parse error with the hint', () => {
			expect(input().value).toBe('31/02/2026');
			expect(host.ctrl.value).toBeNull();
			expect(host.ctrl.errors?.['hubDatepickerParse']).toEqual({ text: '31/02/2026', format: 'dd/mm/yyyy' });
		});

		it('keeps required on the control but shows only the parse message', () => {
			expect(host.ctrl.errors?.['required']).toBe(true);
			expect(messages()).toEqual(['Enter a valid date (dd/mm/yyyy).']);
		});

		it('recovers once a valid date is typed', () => {
			type('20/06/2026');
			enter();

			expect(host.ctrl.value).toBe('2026-06-20');
			expect(host.ctrl.errors).toBeNull();
		});
	});

	describe('bounds', () => {
		it('reports min with the bound written like the field shows it', () => {
			host.min.set('2026-06-10');
			fixture.detectChanges();
			type('01/06/2026');
			enter();
			host.ctrl.markAsTouched();
			fixture.detectChanges();

			const error = host.ctrl.errors?.['hubDatepickerMin'];

			expect(error.minText).toBe('10/06/2026');
			expect(error.actual).toEqual(new Date(2026, 5, 1));
			expect(messages()).toEqual(['The date must be 10/06/2026 or later.']);
		});

		it('reports max with the bound written like the field shows it', () => {
			host.max.set('2026-06-30');
			fixture.detectChanges();
			type('01/07/2026');
			enter();
			host.ctrl.markAsTouched();
			fixture.detectChanges();

			expect(host.ctrl.errors?.['hubDatepickerMax'].maxText).toBe('30/06/2026');
			expect(messages()).toEqual(['The date must be 30/06/2026 or earlier.']);
		});

		it('accepts the bound itself', () => {
			host.min.set('2026-06-10');
			fixture.detectChanges();
			type('10/06/2026');
			enter();

			expect(host.ctrl.errors).toBeNull();
		});

		it('invalidates a programmatic out-of-range value', () => {
			host.min.set('2026-06-10');
			fixture.detectChanges();
			host.ctrl.setValue('2026-06-01');
			fixture.detectChanges();

			expect(host.ctrl.errors?.['hubDatepickerMin']).toBeDefined();
		});
	});

	describe('read-only input', () => {
		it('is typeable by default', () => {
			expect(input().readOnly).toBe(false);
		});

		it('is read-only with [typeable]="false"', () => {
			host.typeable.set(false);
			fixture.detectChanges();

			expect(input().readOnly).toBe(true);
		});

		it('is read-only when the control is disabled', () => {
			host.ctrl.disable();
			fixture.detectChanges();

			expect(input().readOnly).toBe(true);
		});
	});

	describe('range mode', () => {
		it('commits both ends from one typed text', () => {
			host.mode.set('range');
			fixture.detectChanges();
			type('10/06/2026 – 20/06/2026');
			enter();

			expect(host.ctrl.value).toEqual({ start: '2026-06-10', end: '2026-06-20' });
			expect(input().value).toBe('10/06/2026 – 20/06/2026');
		});

		it('accepts a plain hyphen as separator', () => {
			host.mode.set('range');
			fixture.detectChanges();
			type('10/06/2026 - 20/06/2026');
			enter();

			expect(host.ctrl.value).toEqual({ start: '2026-06-10', end: '2026-06-20' });
		});

		it('rejects an end before the start', () => {
			host.mode.set('range');
			fixture.detectChanges();
			type('20/06/2026 – 10/06/2026');
			enter();

			expect(host.ctrl.value).toBeNull();
			expect(host.ctrl.errors?.['hubDatepickerParse']).toBeDefined();
		});
	});
});

describe('HubDatepickerComponent typing config', () => {
	afterEach(() => document.querySelectorAll('.hub-overlay-container, .hub-overlay-backdrop').forEach((el) => el.remove()));

	it('provideHubForms({ datepicker: { typeable: false } }) makes the input read-only', () => {
		TestBed.configureTestingModule({
			imports: [TypingHostComponent, NoopAnimationsModule],
			providers: [provideHubForms({ datepicker: { typeable: false } })]
		});
		const fixture = TestBed.createComponent(TypingHostComponent);
		fixture.componentInstance.typeable.set(false);
		fixture.detectChanges();

		expect((fixture.nativeElement.querySelector('.hub-datepicker__input') as HTMLInputElement).readOnly).toBe(true);
	});
});

describe('defaultInvalidFeedback for the datepicker keys', () => {
	it('words the parse error with and without a hint', () => {
		expect(defaultInvalidFeedback('hubDatepickerParse', { text: 'x', format: 'dd/mm/yyyy' })).toBe(
			'Enter a valid date (dd/mm/yyyy).'
		);
		expect(defaultInvalidFeedback('hubDatepickerParse', { text: 'x' })).toBe('Enter a valid date.');
	});

	it('prefers minText and maxText over the raw bound', () => {
		expect(defaultInvalidFeedback('hubDatepickerMin', { min: new Date(2026, 5, 10), minText: '10/06/2026' })).toBe(
			'The date must be 10/06/2026 or later.'
		);
		expect(defaultInvalidFeedback('hubDatepickerMax', { max: new Date(2026, 5, 10), maxText: '10/06/2026' })).toBe(
			'The date must be 10/06/2026 or earlier.'
		);
	});

	it('falls back to the bound when there is no text', () => {
		expect(defaultInvalidFeedback('hubDatepickerMin', { min: '2026-06-10' })).toBe('The date must be 2026-06-10 or later.');
	});

	it('words the disabled error', () => {
		expect(defaultInvalidFeedback('hubDatepickerDisabled', { actual: new Date() })).toBe('This date is not available.');
	});
});
