import { Component, Type, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { provideHubForms } from '../services/forms-config';
import { HubSelectComponent } from './select.component';
import { NgSelectComponent } from './vendor/lib/ng-select.component';

/** Mounts a host and hands back the engine the wrapper is driving. */
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
	template: ` <hub-select [formControl]="ctrl" [items]="items()" bindLabel="name" [searchFn]="byRoom" label="Pick" /> `
})
class SearchHostComponent {
	readonly ctrl = new FormControl<unknown>(null);
	readonly items = signal([{ name: 'Ada', room: 'Triana' }]);

	/** Matches on something the option carries but the label never shows. */
	readonly byRoom = (term: string, item: { room: string }) => item.room.toLowerCase().includes(term.toLowerCase());
}

@Component({
	standalone: true,
	imports: [HubSelectComponent, ReactiveFormsModule],
	template: `<hub-select [formControl]="ctrl" [items]="items()" [addTag]="addTag" label="Pick" />`
})
class RefusedTagHostComponent {
	readonly ctrl = new FormControl<unknown>(null);
	readonly items = signal<unknown[]>([]);

	/** The creation dialog the user dismissed, the request the server refused. */
	readonly addTag = () => Promise.resolve(null);
}

@Component({
	standalone: true,
	imports: [HubSelectComponent, ReactiveFormsModule],
	template: `<hub-select [formControl]="ctrl" [items]="items()" [addTag]="addTag" label="Customer" />`
})
class DialogTagHostComponent {
	readonly ctrl = new FormControl<unknown>(null);
	readonly items = signal<unknown[]>([]);

	/** Resolved by hand, standing in for the modal the consumer opens to fill the new record in. */
	resolve!: (value: unknown) => void;

	readonly addTag = (term: string) =>
		new Promise<unknown>((resolve) => {
			this.resolve = () => resolve({ name: term });
		});
}

@Component({
	standalone: true,
	imports: [HubSelectComponent, ReactiveFormsModule],
	template: `
		<hub-select
			[formControl]="ctrl"
			[items]="items()"
			[multiple]="true"
			[addTag]="true"
			[closeOnSelect]="false"
			[clearSearchOnAdd]="true"
			label="Tags"
		/>
	`
})
class ClearSearchHostComponent {
	readonly ctrl = new FormControl<unknown>([]);
	readonly items = signal<unknown[]>([]);
}

describe('hub-select — searching and tagging', () => {
	/**
	 * The wrapper used to swallow this one.
	 *
	 * The engine has always taken a `searchFn`, but `<hub-select>` never passed it on, so a
	 * consumer who wanted to match on something the option shows and the label does not — the
	 * building a room is in, the code beside a name — had to smuggle it into `bindLabel` and
	 * then hide it again behind a label template.
	 */
	it('hands the consumer search function down to the engine', async () => {
		const { fixture, engine } = await render(SearchHostComponent);
		const host = fixture.componentInstance as SearchHostComponent;

		expect(engine.searchFn()).toBe(host.byRoom);
	});

	/**
	 * An `addTag` that resolves with nothing is saying "there is nothing to add".
	 *
	 * The synchronous branch has always guarded that; the promise branch did not, so a
	 * dismissed creation dialog became an option built out of `null`, pushed into the list and
	 * written into the form — the caller said no and the field answered with a record that
	 * does not exist. Nobody meets this by hand: you have to cancel the dialog to see it.
	 */
	it('adds nothing when an async addTag resolves empty', async () => {
		const { fixture, engine } = await render(RefusedTagHostComponent);
		const host = fixture.componentInstance as RefusedTagHostComponent;

		// The public way in: typing is what sets the term the tag would be built from.
		engine.filter('Something new');
		engine.selectTag();
		await fixture.whenStable();
		fixture.detectChanges();

		expect(host.ctrl.value).toBeNull();
		expect(engine.selectedItems.length).toBe(0);
	});

	/**
	 * An `addTag` that opens a dialog has to get the list out of the way first.
	 *
	 * The panel is appended to `<body>` and sits above the modal layer, so while the promise was
	 * pending it covered the form the user had just been sent to fill in — and if the dialog was
	 * dismissed, the promise resolved with nothing and the list never closed at all. Measured in
	 * a real page: `.ng-dropdown-panel` at z-index 1060 over a modal at 1055.
	 */
	it('closes the list as soon as an async addTag is chosen, not when it resolves', async () => {
		const { fixture, engine } = await render(DialogTagHostComponent);
		const host = fixture.componentInstance as DialogTagHostComponent;

		engine.open();
		await fixture.whenStable();
		engine.filter('Ada Lovelace');
		engine.selectTag();
		await fixture.whenStable();
		fixture.detectChanges();

		// The dialog is still open — nothing has resolved — and the list is already gone.
		expect(engine.isOpen()).toBe(false);
		expect(document.querySelector('ng-dropdown-panel')).toBeNull();

		host.resolve(null);
		await fixture.whenStable();
		fixture.detectChanges();

		// And the value the dialog produced still lands.
		expect(host.ctrl.value).toEqual({ name: 'Ada Lovelace' });
	});

	/**
	 * `clearSearchOnAdd` used to stop at the wrapper.
	 *
	 * The engine has always taken it, and falls back to `closeOnSelect` when it is not given —
	 * right until the two are wanted apart, which is exactly a tag field: it stays open to take
	 * the next value and still has to forget the term it just used. Binding it on `<hub-select>`
	 * was an NG8002, so the only way to empty the box was to close the list after every value.
	 */
	it('hands clearSearchOnAdd down to the engine, apart from closeOnSelect', async () => {
		const { engine } = await render(ClearSearchHostComponent);

		expect(engine.clearSearchOnAddValue()).toBe(true);
		expect(engine.closeOnSelect()).toBe(false);
	});

	/**
	 * Left unbound it stays the engine's business, which means `closeOnSelect` decides — the
	 * behaviour every existing field already has.
	 */
	it('leaves clearSearchOnAdd to the engine when the consumer says nothing', async () => {
		const { engine } = await render(RefusedTagHostComponent);

		expect(engine.clearSearchOnAdd()).toBeUndefined();
		expect(engine.clearSearchOnAddValue()).toBe(engine.closeOnSelect());
	});
});
