import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { HUB_FIELD_FEEDBACK } from 'ng-hub-ui-utils';
import { afterEach, describe, expect, it } from 'vitest';

import { HubInputComponent } from '../components/input/input.component';

const placement = signal<'bottom' | 'tooltip'>('tooltip');

@Component({
	standalone: true,
	imports: [HubInputComponent, FormsModule],
	providers: [{ provide: HUB_FIELD_FEEDBACK, useValue: placement }],
	template: `<hub-input [(ngModel)]="value" [required]="true" label="Name" />`
})
class WithProviderHostComponent {
	value = '';
}

@Component({
	standalone: true,
	imports: [HubInputComponent, FormsModule],
	template: `<hub-input [(ngModel)]="value" [required]="true" label="Name" />`
})
class WithoutProviderHostComponent {
	value = '';
}

describe('field feedback as a tooltip (HUB_FIELD_FEEDBACK)', () => {
	afterEach(() => {
		placement.set('tooltip');
		document.body.querySelectorAll('.hub-tooltip').forEach((el) => el.remove());
	});

	/** Renders the host, touches the field and lets the render hooks sync the tooltip. */
	async function setup<T>(host: new () => T) {
		TestBed.configureTestingModule({ imports: [host], providers: [provideZonelessChangeDetection()] });
		const fixture = TestBed.createComponent(host);
		fixture.detectChanges();
		await fixture.whenStable();

		const field: HTMLElement = fixture.debugElement.query(By.directive(HubInputComponent)).nativeElement;
		const input: HTMLInputElement = field.querySelector('input')!;

		input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		return { fixture, field };
	}

	it('marks the host and shows the error text on hover when an ancestor asks for a tooltip', async () => {
		const { field } = await setup(WithProviderHostComponent);

		expect(field.classList).toContain('hub-field-host--feedback-tooltip');

		const message = field.querySelector('.hub-field__feedback[role="alert"]')!.textContent!.replace(/\s+/g, ' ').trim();

		expect(message).not.toBe('');

		field.dispatchEvent(new MouseEvent('mouseenter'));

		const tip = document.body.querySelector('.hub-tooltip');

		expect(tip?.getAttribute('role')).toBe('tooltip');
		expect(tip?.textContent).toBe(message);
	});

	it('shows no tooltip while the field is untouched', async () => {
		TestBed.configureTestingModule({ imports: [WithProviderHostComponent], providers: [provideZonelessChangeDetection()] });
		const fixture = TestBed.createComponent(WithProviderHostComponent);
		fixture.detectChanges();
		await fixture.whenStable();

		const field: HTMLElement = fixture.debugElement.query(By.directive(HubInputComponent)).nativeElement;
		field.dispatchEvent(new MouseEvent('mouseenter'));

		expect(document.body.querySelector('.hub-tooltip')).toBeNull();
	});

	it('does nothing without the provider', async () => {
		const { field } = await setup(WithoutProviderHostComponent);

		expect(field.classList).not.toContain('hub-field-host--feedback-tooltip');

		field.dispatchEvent(new MouseEvent('mouseenter'));

		expect(document.body.querySelector('.hub-tooltip')).toBeNull();
	});

	it('does nothing when the provider says bottom', async () => {
		placement.set('bottom');
		const { field } = await setup(WithProviderHostComponent);

		expect(field.classList).not.toContain('hub-field-host--feedback-tooltip');

		field.dispatchEvent(new MouseEvent('mouseenter'));

		expect(document.body.querySelector('.hub-tooltip')).toBeNull();
	});
});
