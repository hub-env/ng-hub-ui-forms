import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, NgModel, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';

import { HubDatepickerComponent } from '../components/datepicker/datepicker.component';
import { HubInputComponent } from '../components/input/input.component';
import { HubTextareaComponent } from '../components/textarea/textarea.component';
import { HubTimepickerComponent } from '../components/timepicker/timepicker.component';
import { HubSelectComponent } from '../select/select.component';
import { provideHubForms } from '../services/forms-config';

/**
 * Every `ngModel` inside a field is standalone, and says so.
 *
 * The fields drive their native control with an inner `[ngModel]`; the value the form holds
 * travels through the ControlValueAccessor on the host, not through that binding. Angular
 * cannot tell the two apart on its own — `NgModel` injects its parent with `@Host()`, which
 * stops at the component boundary — so it warned once per control (NG01354) that an `ngModel`
 * under a `formGroup` would not register. Eight controls in a dialog, eight lines of console,
 * in an application whose author wrote none of them and cannot silence them.
 *
 * Declaring the option is the documented way to say "this one is not part of your form". It
 * changes no behaviour: with no reachable parent these bindings were already standalone. What
 * it changes is that the intent is now written down, which is what the diagnostic reads.
 */
@Component({
	standalone: true,
	imports: [
		HubInputComponent,
		HubTextareaComponent,
		HubSelectComponent,
		HubDatepickerComponent,
		HubTimepickerComponent,
		ReactiveFormsModule
	],
	template: `
		<form [formGroup]="form">
			<hub-input formControlName="name" label="Name" />
			<hub-input type="counter" formControlName="units" label="Units" />
			<hub-textarea formControlName="notes" label="Notes" />
			<hub-select formControlName="city" label="City" [items]="cities" />
			<hub-datepicker formControlName="arrival" label="Arrival" />
			<hub-timepicker formControlName="start" label="Start" />
		</form>
	`
})
class ReactiveFormHostComponent {
	readonly form = new FormGroup({
		name: new FormControl(''),
		units: new FormControl(1),
		notes: new FormControl(''),
		city: new FormControl<unknown>(null),
		arrival: new FormControl<unknown>(null),
		start: new FormControl<unknown>(null)
	});
	readonly cities = ['Madrid', 'Bilbao'];
}

describe('inner ngModel bindings inside a reactive form', () => {
	it('declares every one of them standalone', async () => {
		TestBed.resetTestingModule();
		await TestBed.configureTestingModule({
			imports: [ReactiveFormHostComponent],
			providers: [provideZonelessChangeDetection(), provideHubForms()]
		}).compileComponents();

		const fixture = TestBed.createComponent(ReactiveFormHostComponent);
		fixture.detectChanges();
		await fixture.whenStable();

		const models = fixture.debugElement.queryAll(By.directive(NgModel)).map((d) => d.injector.get(NgModel));

		// The fields under test all drive their control this way, so an empty list would mean the
		// query stopped matching rather than that the problem is gone.
		expect(models.length).toBeGreaterThan(0);
		models.forEach((model) => expect(model.options?.standalone).toBe(true));
	});

	/** And the form still gets the values, which is the thing the option must not cost. */
	it('keeps the form bound to what the fields hold', async () => {
		TestBed.resetTestingModule();
		await TestBed.configureTestingModule({
			imports: [ReactiveFormHostComponent],
			providers: [provideZonelessChangeDetection(), provideHubForms()]
		}).compileComponents();

		const fixture = TestBed.createComponent(ReactiveFormHostComponent);
		fixture.detectChanges();
		await fixture.whenStable();

		const host = fixture.componentInstance as ReactiveFormHostComponent;
		const input = fixture.nativeElement.querySelector('hub-input input') as HTMLInputElement;

		input.value = 'Ada';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await fixture.whenStable();

		expect(host.form.controls.name.value).toBe('Ada');
	});
});
