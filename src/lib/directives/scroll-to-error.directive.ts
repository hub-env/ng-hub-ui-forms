import { Directive, ElementRef, inject, input } from '@angular/core';

/**
 * What reads as an error out of the box: an invalid hub field, a control marked
 * `aria-invalid`, and the message a hub field shows under itself.
 */
const DEFAULT_ERROR_SELECTOR = [
	'.hub-field__control--invalid',
	'[aria-invalid="true"]',
	'.hub-field__feedback:not(.hub-field__feedback--valid)'
].join(',');

const FOCUSABLE =
	'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Takes the person to what is wrong, on the button that found it.
 *
 * Put it on a submit or «Next» button. It answers for the button's own form (the one it sits in,
 * or the one its `form` attribute names), or for the element you give it. Each press that leaves errors on screen scrolls to the next one and focuses its
 * control, so a long form with three mistakes is walked in three presses instead of hunted by
 * eye; after the last one it starts again from the first.
 *
 * It reads the page and not a form model, because errors come from several places: reactive
 * controls, fields drawn from a schema, the cells of a sheet. What counts as an error is the
 * hub fields' own invalid state plus whatever `hubScrollToErrorSelector` adds, so a product can
 * teach it its own error marks without forking it.
 *
 * It runs after the button's own handler has had a frame to paint the errors, and does nothing
 * when there are none, so it never stands in the way of a valid submit. Scrolling is instant
 * when the reader asks for reduced motion.
 *
 * @example
 * ```html
 * <form id="customer" hubForm [formGroup]="group" (submit)="save()">…</form>
 * <button hubButton type="submit" form="customer" hubScrollToError>Save</button>
 *
 * <!-- Another block of the page, with a product's own error marks as well -->
 * <section #sheet>…</section>
 * <button [hubScrollToError]="sheet" hubScrollToErrorSelector=".my-error, .hub-spreadsheet__cell--invalid">
 * ```
 */
@Directive({
	selector: '[hubScrollToError]',
	host: { '(click)': 'onClick()' }
})
export class HubScrollToErrorDirective {
	/**
	 * The block of the page whose errors this button walks. Left empty, the button's own form:
	 * a template reference on `<form hubForm>` names the component, not the element, so the
	 * form is reached through the button instead.
	 */
	readonly hubScrollToError = input<HTMLElement | ElementRef<HTMLElement> | ''>('');

	/** More CSS selectors that read as an error, added to the hub fields' own. */
	readonly hubScrollToErrorSelector = input<string>('');

	readonly #host: HTMLElement = inject(ElementRef).nativeElement;

	#next = 0;
	#last: Element | null = null;

	protected onClick(): void {
		// Two frames: the handler sets the errors, the next frame paints them.
		requestAnimationFrame(() => requestAnimationFrame(() => this.goToNextError()));
	}

	/** Scrolls to the next error on screen and focuses it; a no-op when there is none. */
	goToNextError(): void {
		const scope = this.hubScrollToError();
		const root =
			scope instanceof ElementRef
				? scope.nativeElement
				: scope || ((this.#host as HTMLButtonElement).form ?? this.#host.closest('form'));

		if (!root) {
			return;
		}

		const errors = this.#visibleErrors(root);

		if (errors.length === 0) {
			this.#next = 0;
			this.#last = null;

			return;
		}

		// A list that changed under the previous target starts again from the top.
		if (!this.#last || !errors.includes(this.#last)) {
			this.#next = 0;
		}

		const target = errors[this.#next % errors.length];
		const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

		target.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
		this.#focusOf(target)?.focus({ preventScroll: true });

		this.#last = target;
		this.#next = (this.#next + 1) % errors.length;
	}

	/** In page order, without those inside a closed branch or a hidden step. */
	#visibleErrors(root: HTMLElement): Element[] {
		const extra = this.hubScrollToErrorSelector().trim();
		const selector = extra ? `${DEFAULT_ERROR_SELECTOR},${extra}` : DEFAULT_ERROR_SELECTOR;
		const found = Array.from(root.querySelectorAll(selector)).filter(
			(element) => (element as HTMLElement).getClientRects().length > 0
		);

		// A field's control and its message are one error, not two, and so are the boxes of a code.
		const fields = new Set<Element>();

		return found.filter((element) => {
			if (found.some((other) => other !== element && other.contains(element))) {
				return false;
			}

			const field = element.closest('.hub-field') ?? element;
			const first = !fields.has(field);
			fields.add(field);

			return first;
		});
	}

	#focusOf(target: Element): HTMLElement | null {
		if (target.matches(FOCUSABLE)) {
			return target as HTMLElement;
		}

		// A grid cell that moves its own focus takes it even at tabindex -1.
		if (target.getAttribute('role') === 'gridcell' || target.hasAttribute('tabindex')) {
			return target as HTMLElement;
		}

		const field = target.closest('.hub-field') ?? target;

		return (field.matches(FOCUSABLE) ? field : field.querySelector(FOCUSABLE)) as HTMLElement | null;
	}
}
