import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { readFileSync } from 'node:fs';
import { compileString } from 'sass';
import { provideHubForms } from '../services/forms-config';
import { HubSelectComponent } from './select.component';

/**
 * The chip of a multiple `<hub-select>` and where its remove cross stands.
 *
 * The vendored engine emits the cross BEFORE the label (`vendor/lib/ng-select.component.html`),
 * which is not what a chip looks like in any other catalogue and was not reachable from outside:
 * the only escape was to redraw the whole chip through the label slot, cross included. The chip is
 * a flex row, so the running order belongs to the stylesheet — and the place of the cross in it to
 * a token, so a consumer who wants it in front can say so without touching the DOM.
 *
 * Asserted on the rules the component publishes rather than on measured boxes: jsdom performs no
 * layout and resolves no `var()`, so measuring here would report an unstyled page and pass whatever
 * it was given. The pixels are checked in a browser before release.
 */
@Component({
	standalone: true,
	imports: [HubSelectComponent, ReactiveFormsModule],
	template: `<hub-select [formControl]="ctrl" [items]="items" [multiple]="true" label="Countries" />`
})
class ChipHostComponent {
	readonly items = ['Spain', 'Portugal', 'France'];
	readonly ctrl = new FormControl<unknown>(['Spain', 'Portugal']);
}

/**
 * Renders the host so the component's stylesheet reaches the document and the chips are drawn.
 * The engine is fed through `[ngModel]`, which settles in a microtask, so the value is only on
 * screen after the fixture is stable.
 */
async function render(): Promise<ComponentFixture<ChipHostComponent>> {
	const fixture = TestBed.configureTestingModule({
		imports: [ChipHostComponent, ReactiveFormsModule],
		providers: [provideHubForms()]
	}).createComponent(ChipHostComponent);
	fixture.detectChanges();
	await fixture.whenStable();
	fixture.detectChanges();

	return fixture;
}

/** The published rules of the multiple-chip scope that declare a running order for `selector`. */
function orderRuleFor(selector: string): string {
	const matching = [...document.styleSheets]
		.flatMap((sheet) => {
			try {
				return [...(sheet.cssRules ?? [])].map((rule) => rule.cssText);
			} catch {
				// A stylesheet from another origin: not ours, and not readable.
				return [];
			}
		})
		.filter((text) => text.includes('.ng-select-multiple') && text.includes(selector) && text.includes('order'));

	// Empty means the rule was renamed or removed, and every assertion below is vacuous.
	expect(matching.length).toBeGreaterThan(0);

	return matching.join('\n');
}

describe('hub-select multiple — the chip draws its remove cross after the text', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('is built on an engine that emits the cross first, which is why the order is CSS', async () => {
		const fixture = await render();
		const chip = fixture.nativeElement.querySelector('.ng-value') as HTMLElement;

		expect(chip).not.toBeNull();

		const parts = [...chip.children].map((child) => child.className);

		// The premise of the fix. If a vendor sync ever reorders these, the CSS below is
		// reversing an order that no longer needs reversing, and this test says so.
		expect(parts[0]).toContain('ng-value-icon');
		expect(parts[1]).toContain('ng-value-label');

		fixture.destroy();
	});

	it('lays the label out before the cross', async () => {
		await render();

		expect(orderRuleFor('.ng-value-label')).toMatch(/order:\s*0/);
	});

	it('leaves the place of the cross to --hub-select-value-remove-order', async () => {
		await render();

		expect(orderRuleFor('.ng-value-icon')).toMatch(/order:\s*var\(--hub-select-value-remove-order,\s*1\)/);
	});

	it('declares the token, so its default is written where the other select tokens are', () => {
		const css = compileString(readFileSync('projects/forms/src/lib/styles/index.scss', 'utf8'), {
			loadPaths: ['projects/forms/src/lib/styles']
		}).css;

		expect(css).toMatch(/--hub-select-value-remove-order:\s*1/);
	});
});
