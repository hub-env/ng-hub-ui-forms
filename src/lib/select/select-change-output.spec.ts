import { Component, Type, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { provideHubForms } from '../services/forms-config';
import { HubSelectComponent } from './select.component';
import { NgSelectComponent } from './vendor/lib/ng-select.component';

/**
 * `(change)` on `<hub-select>`.
 *
 * Until it was declared as an output, `(change)` on the element was an ordinary DOM listener:
 * it caught whatever the inner search input happened to bubble, stayed silent for a value added
 * by an asynchronous `addTag`, and compiled without a word either way — which is the part that
 * cost the time. A consumer who wrote it got a handler that fired sometimes.
 *
 * It carries the selected ITEM, the way `ng-select` has always spelled this event; the bound
 * value has its own output and its own name.
 */
async function render<T>(host: Type<T>) {
	TestBed.resetTestingModule();
	await TestBed.configureTestingModule({
		imports: [host],
		providers: [provideZonelessChangeDetection(), provideHubForms()]
	}).compileComponents();

	const fixture = TestBed.createComponent(host);
	fixture.detectChanges();
	await fixture.whenStable();

	const engine = fixture.debugElement.query((d) => d.componentInstance instanceof NgSelectComponent)
		?.componentInstance as NgSelectComponent;

	return { fixture, engine };
}

@Component({
	standalone: true,
	imports: [HubSelectComponent, ReactiveFormsModule],
	template: `
		<hub-select
			[formControl]="ctrl"
			[items]="items()"
			bindLabel="name"
			bindValue="id"
			[addTag]="addTag"
			label="Customer"
			(change)="seen.push($event)"
		/>
	`
})
class DropdownHostComponent {
	readonly ctrl = new FormControl<unknown>(null);
	readonly items = signal([
		{ id: 1, name: 'Ada' },
		{ id: 2, name: 'Grace' }
	]);
	readonly seen: unknown[] = [];

	readonly addTag = (term: string) => Promise.resolve({ id: 99, name: term });
}

@Component({
	standalone: true,
	imports: [HubSelectComponent, ReactiveFormsModule],
	template: `
		<hub-select
			[formControl]="ctrl"
			[items]="items()"
			format="buttons"
			bindLabel="name"
			bindValue="id"
			label="View"
			(change)="seen.push($event)"
		/>
	`
})
class ButtonsHostComponent {
	readonly ctrl = new FormControl<unknown>(null);
	readonly items = signal([
		{ id: 'list', name: 'List' },
		{ id: 'grid', name: 'Grid' }
	]);
	readonly seen: unknown[] = [];
}

describe('hub-select (change)', () => {
	it('emits the selected item, not the bound value', async () => {
		const { fixture, engine } = await render(DropdownHostComponent);
		const host = fixture.componentInstance as DropdownHostComponent;

		engine.select(engine.itemsList.items[1]);
		await fixture.whenStable();

		expect(host.ctrl.value).toBe(2);
		expect(host.seen).toEqual([{ id: 2, name: 'Grace' }]);
	});

	/** The case a DOM listener could never see: nothing is typed into the input at all. */
	it('emits for a value an async addTag created', async () => {
		const { fixture, engine } = await render(DropdownHostComponent);
		const host = fixture.componentInstance as DropdownHostComponent;

		engine.filter('Hedy');
		engine.selectTag();
		await fixture.whenStable();
		fixture.detectChanges();

		expect(host.ctrl.value).toBe(99);
		expect(host.seen).toEqual([{ id: 99, name: 'Hedy' }]);
	});

	/**
	 * The formats without an engine emit the same shape, so a consumer never has to know which
	 * one the field is bound to.
	 */
	it('emits the item for the button / checkbox / radio formats too', async () => {
		const { fixture } = await render(ButtonsHostComponent);
		const host = fixture.componentInstance as ButtonsHostComponent;

		const buttons = fixture.nativeElement.querySelectorAll('button');
		(buttons[1] as HTMLButtonElement).click();
		await fixture.whenStable();

		expect(host.ctrl.value).toBe('grid');
		expect(host.seen).toEqual([{ id: 'grid', name: 'Grid' }]);
	});
});
