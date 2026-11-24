import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { vi } from 'vitest';
import { provideHubForms } from '../services/forms-config';
import { HubSelectComponent } from './select.component';

/**
 * The open list of a chip lines up with the whole group (name plus value), not the value part.
 * Boxes are mocked because jsdom performs no layout.
 */
@Component({
	standalone: true,
	imports: [HubSelectComponent, ReactiveFormsModule],
	template: `<hub-select [formControl]="ctrl" [items]="['Open', 'Closed']" label="Status" prepend="Status" />`
})
class ChipAnchorHostComponent {
	readonly ctrl = new FormControl<unknown>(null);
}

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

describe('hub-select list anchor', () => {
	let style: HTMLStyleElement;

	/** Renders the select with `--hub-select-dropdown-anchor` set to `anchor` on its host. */
	const render = async (anchor: string) => {
		style.textContent = `hub-select { --hub-select-dropdown-anchor: ${anchor}; }`;
		await TestBed.configureTestingModule({
			imports: [ChipAnchorHostComponent],
			providers: [provideZonelessChangeDetection(), provideHubForms()]
		}).compileComponents();
		const fixture = TestBed.createComponent(ChipAnchorHostComponent);
		fixture.detectChanges();
		await fixture.whenStable();
		return fixture;
	};

	beforeEach(() => {
		style = document.createElement('style');
		document.head.appendChild(style);
	});

	afterEach(() => {
		style.remove();
		vi.restoreAllMocks();
		document.querySelectorAll('hub-select-panel').forEach((panel) => panel.remove());
	});

	const anchorOf = (fixture: any): HTMLElement | null => {
		const select = fixture.debugElement.children[0].componentInstance;
		return select._dropdownAnchor();
	};

	it('resolves to the group element when the host asks for group', async () => {
		const fixture = await render('group');

		expect(anchorOf(fixture)).toBe(fixture.nativeElement.querySelector('.hub-select__group'));
	});

	it.each(['control', ''])('resolves to null when the host asks for "%s"', async (value) => {
		const fixture = await render(value || 'control');

		expect(anchorOf(fixture)).toBeNull();
	});

	/** Opens the list with the group 300px wide and the control 120px wide. */
	const openList = async (anchor: string) => {
		vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
			if (this === document.body) return box(0, 1000, 0, 2000);
			if (this.tagName.toLowerCase() === 'hub-select-panel') return box(0, 240, 0, 120);
			if (this.classList.contains('hub-select__group')) return box(40, 300);
			if (this.classList.contains('ng-select-container') || this.classList.contains('ng-select')) return box(100, 120);
			return box(0, 0, 0, 0);
		});
		Object.defineProperty(document.documentElement, 'clientWidth', { value: 1000, configurable: true });

		const fixture = await render(anchor);
		fixture.nativeElement
			.querySelector('.ng-select-container')
			.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		await fixture.whenStable();
		await new Promise((r) => setTimeout(r, 20));
		await fixture.whenStable();

		return document.querySelector('hub-select-panel') as HTMLElement;
	};

	// fork: utils overlay — the minimum sits on the panel itself, there is no CDK pane.
	const paneMinWidth = (panel: HTMLElement) => panel.style.minWidth;

	it('gives the list the group width as its minimum when the host asks for group', async () => {
		expect(paneMinWidth(await openList('group'))).toBe('300px');
	});

	it('leaves the list on the control when there is no group anchor', async () => {
		expect(paneMinWidth(await openList('control'))).toBe('120px');
	});
});
