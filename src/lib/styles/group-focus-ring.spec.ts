import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { HubInputComponent } from '../components/input/input.component';

/**
 * A field with something attached is one field to the reader, so it gets one focus ring, drawn
 * by the group. The ring used to belong to the box and stopped at the seam with the addon.
 *
 * Asserted against the rules the component actually ships, read back from the document, with the
 * cascade's own tie-breakers: the box's ring has to lose to the group's "give it up" rule, or the
 * reader sees two rings.
 */
@Component({
	standalone: true,
	imports: [HubInputComponent],
	template: `
		<hub-input id="attached" append="EUR" />
		<hub-input id="plain" />
	`
})
class HostComponent {}

type Hit = { selector: string; value: string; spec: number[]; order: number };

/** Specificity with `:is()` / `:has()` / `:not()` weighed by their contents, as the cascade does. */
function specificity(selector: string): number[] {
	const flat = selector.replace(/:(?:is|has|not)\(([^)]*)\)/g, (_m, inner: string) => inner.split(',')[0]);
	const classes = (flat.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+(?!\()/g) ?? []).length;
	const elements = (flat.match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length;
	return [(flat.match(/#[\w-]+/g) ?? []).length, classes, elements];
}

/** Every `box-shadow` declaration that reaches the element, strongest last. */
function boxShadowRules(el: Element): Hit[] {
	const hits: Hit[] = [];
	let order = 0;
	for (const sheet of [...document.styleSheets]) {
		for (const rule of [...sheet.cssRules] as CSSStyleRule[]) {
			order++;
			const value = rule.style?.getPropertyValue('box-shadow');
			if (!rule.selectorText || !value) continue;
			for (const selector of rule.selectorText.split(/,(?![^(]*\))/).map((s) => s.trim())) {
				try {
					if (el.matches(selector)) hits.push({ selector, value, spec: specificity(selector), order });
				} catch {
					/* a selector jsdom cannot parse tells us nothing */
				}
			}
		}
	}
	return hits.sort((a, b) => a.spec[0] - b.spec[0] || a.spec[1] - b.spec[1] || a.spec[2] - b.spec[2] || a.order - b.order);
}

describe('focus ring of a field with something attached', () => {
	beforeEach(() => {
		const fixture = TestBed.createComponent(HostComponent);
		fixture.detectChanges();
	});

	const control = (id: string) => document.querySelector<HTMLInputElement>(`#${id} input`)!;
	const group = (id: string) => document.querySelector(`#${id} .hub-input__group`)!;

	it('moves the ring from the box to the group', () => {
		control('attached').focus();

		expect(boxShadowRules(control('attached')).at(-1)?.value).toBe('none');
		expect(boxShadowRules(group('attached')).some((hit) => hit.selector.includes(':focus-within'))).toBe(true);
	});

	it('leaves the ring on the control when nothing is attached', () => {
		control('plain').focus();

		expect(boxShadowRules(control('plain')).at(-1)?.value).not.toBe('none');
		expect(boxShadowRules(group('plain')).some((hit) => hit.selector.includes(':focus-within'))).toBe(false);
	});
});
