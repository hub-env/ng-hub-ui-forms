import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { vi } from 'vitest';
import { provideHubForms } from '../services/forms-config';
import { HubSelectComponent } from './select.component';

/**
 * A panel appended to `body` may be wider than its control, to show its options whole. It
 * keeps the control's width as its minimum, opens from the control's start, and from its end
 * when it would otherwise run off the screen.
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
		if (this.tagName.toLowerCase() === 'ng-dropdown-panel') return box(0, 240, 0, 120);
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

	return document.querySelector('ng-dropdown-panel') as HTMLElement;
}

describe('hub-select dropdown width and side (appendTo body)', () => {
	beforeEach(() => {
		Object.defineProperty(document.documentElement, 'clientWidth', { value: 1000, configurable: true });
	});

	afterEach(() => {
		vi.restoreAllMocks();
		document.querySelectorAll('ng-dropdown-panel').forEach((panel) => panel.remove());
	});

	it('keeps the control width as a minimum and leaves the rest to the stylesheet', async () => {
		const panel = await openPanel(100);

		expect(panel.style.minWidth).toBe('120px');
		expect(panel.style.width, 'no inline width capping the options').toBe('');
	});

	it('opens from the control start when it fits', async () => {
		const panel = await openPanel(100);

		expect(panel.style.left).toBe('100px');
	});

	it('opens from the control end when it would run off the right edge', async () => {
		// Control from 860 to 980: a 240px panel from its start would end at 1100.
		const panel = await openPanel(860);

		expect(panel.style.left, 'panel right edge = control right edge').toBe('740px');
	});
});
