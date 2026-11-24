import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { vi } from 'vitest';
import { provideHubForms } from '../services/forms-config';
import { HubSelectComponent } from './select.component';

/**
 * The list is never narrower than its control, whose width is the overlay pane's minimum,
 * and grows to its options.
 */
@Component({
	standalone: true,
	imports: [HubSelectComponent, ReactiveFormsModule],
	template: `<hub-select [formControl]="ctrl" [items]="items()" label="Payment" />`
})
class HorizontalPositionHostComponent {
	readonly ctrl = new FormControl<unknown>(null);
	readonly items = signal<unknown[]>(['Unpaid', 'Partially paid', 'Paid']);
}

/** Builds a DOMRect-like box from its left edge and size. */
function box(left: number, width: number, top = 100, height = 38): DOMRect {
	return {
		top,
		bottom: top + height,
		height,
		left,
		right: left + width,
		width,
		x: left,
		y: top,
		toJSON: () => ({})
	} as DOMRect;
}

/** Opens a select whose control sits at `controlLeft`, 120px wide, with a 240px panel. */
async function openPanel(controlLeft: number): Promise<HTMLElement> {
	vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
		if (this === document.body) return box(0, 1000, 0, 2000);
		if (this.tagName.toLowerCase() === 'hub-select-panel') return box(0, 240, 0, 120);
		if (this.classList.contains('ng-select-container') || this.classList.contains('ng-select')) {
			return box(controlLeft, 120);
		}
		return box(0, 0, 0, 0);
	});

	await TestBed.configureTestingModule({
		imports: [HorizontalPositionHostComponent],
		providers: [provideHubForms()]
	}).compileComponents();

	const fixture = TestBed.createComponent(HorizontalPositionHostComponent);
	fixture.detectChanges();
	await fixture.whenStable();

	const container = fixture.nativeElement.querySelector('.ng-select-container') as HTMLElement;
	container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
	await fixture.whenStable();
	await new Promise((r) => setTimeout(r, 20));
	await fixture.whenStable();

	return document.querySelector('hub-select-panel') as HTMLElement;
}

describe('hub-select dropdown width', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		document.querySelectorAll('hub-select-panel').forEach((panel) => panel.remove());
	});

	it('keeps the control width as a minimum on the overlay and pins no width', async () => {
		// fork: utils overlay — the minimum sits on the panel (the container is shrink-to-fit), no CDK pane.
		const panel = await openPanel(100);
		const container = panel.closest('.hub-overlay-container') as HTMLElement;

		expect(panel.style.minWidth).toBe('120px');
		expect(container.style.width, 'no width capping the options').toBe('');
	});

	it('lets the list grow to its options, up to the theme maximum', async () => {
		const panel = await openPanel(100);
		const rules = matchingRules(panel);

		expect(rules.some((r) => r.style.getPropertyValue('width') === 'max-content')).toBe(true);
		expect(rules.some((r) => r.cssText.includes('--hub-select-dropdown-max-width'))).toBe(true);
	});

	it('does not dress the list with the control rules it inherits through the mirrored host classes', async () => {
		const panel = await openPanel(100);
		const leaks = matchingRules(panel).filter(
			(r) =>
				/invalid/.test(r.cssText) ||
				/(^|;|\s)(padding|min-height|height)\s*:/.test(r.style.cssText.replace(/-[a-z-]+:/g, ''))
		);

		expect(panel.classList.contains('hub-select__control')).toBe(true);
		expect(leaks.map((r) => r.selectorText)).toEqual([]);
	});
});

/** Every style rule of the document that applies to `element`. */
function matchingRules(element: Element): CSSStyleRule[] {
	const rules: CSSStyleRule[] = [];
	for (const sheet of Array.from(document.styleSheets)) {
		for (const rule of Array.from(sheet.cssRules)) {
			if (rule instanceof CSSStyleRule && matches(element, rule.selectorText)) rules.push(rule);
		}
	}
	return rules;
}

/** `matches` that treats a selector jsdom cannot parse (vendor pseudo-elements) as not matching. */
function matches(element: Element, selector: string): boolean {
	try {
		return element.matches(selector);
	} catch {
		return false;
	}
}
