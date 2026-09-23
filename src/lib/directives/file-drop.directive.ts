import { DOCUMENT } from '@angular/common';
import {
	booleanAttribute,
	ComponentRef,
	DestroyRef,
	Directive,
	ElementRef,
	effect,
	inject,
	input,
	numberAttribute,
	output,
	PLATFORM_ID,
	Renderer2,
	signal,
	ViewContainerRef
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { HubFileDropOverlayComponent } from '../components/file-drop/file-drop-overlay.component';
import { HubFileRejection, HubFileRejectionReason } from '../interfaces/file-input.interface';
import { HUB_FORMS_CONFIG } from '../services/forms-config';
import { matchesAccept } from '../utils/file-accept';

/** What the drag is watched on: the element carrying the directive, or the whole window. */
export type HubFileDropScope = 'element' | 'window';

/**
 * Turns a container — or the whole window — into a zone that takes dropped files.
 *
 * `<hub-file-input>` only accepts a drop inside its own box, which is right for a field and
 * wrong for a screen: on a list of expenses the natural gesture is to drop the receipt anywhere
 * on the page, and nothing in the library listened at that level. So every application that
 * wanted it wrote the same component again — the window listeners, the card over the page, the
 * type and size checks by hand — and got the same three details wrong, the worst of which is
 * silent: a file dropped outside a drop target makes the browser navigate away from the page,
 * unsaved form and all.
 *
 * The directive raises its own card while the drag is over the target, applies the same
 * constraints a file field applies (`accept`, `maxSize`, `minSize`, `maxFiles`) with the same
 * rejection shape, and hands back what passed.
 *
 * It is an addition to a file field and not a replacement: dragging is a pointer gesture, so the
 * card is `aria-hidden` and the keyboard route stays the field's.
 *
 * @example
 * ```html
 * <section hubFileDrop="window" accept="image/*" [maxSize]="5_000_000"
 *          (filesDropped)="attach($event)" (rejected)="warn($event)">
 *   …the screen…
 * </section>
 * ```
 */
@Directive({
	selector: '[hubFileDrop]',
	standalone: true,
	host: {
		'[class.hub-file-drop]': 'true',
		'[class.hub-file-drop--active]': 'dragActive()'
	}
})
export class HubFileDropDirective {
	readonly #document = inject(DOCUMENT);
	readonly #element = inject(ElementRef<HTMLElement>);
	readonly #renderer = inject(Renderer2);
	readonly #viewContainer = inject(ViewContainerRef);
	readonly #config = inject(HUB_FORMS_CONFIG);
	readonly #isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

	/**
	 * Where the drag is watched. `element` is the host and its subtree; `window` is the whole
	 * page, which is the one that also stops the browser from opening a file dropped beside the
	 * target instead of on it.
	 */
	readonly hubFileDrop = input<HubFileDropScope | ''>('element');

	/** Accepted types, in the same grammar as a file field's `accept`. */
	readonly accept = input<string>('*');

	/** Largest accepted file, in bytes. */
	readonly maxSize = input<number | null>(null);

	/** Smallest accepted file, in bytes. */
	readonly minSize = input<number | null>(null);

	/** How many files one drop may carry. Anything beyond it is rejected, not silently dropped. */
	readonly maxFiles = input<number | null>(null, { transform: (value: unknown) => toLimit(value) });

	/** Whether the zone is currently accepting drops. */
	readonly dropDisabled = input(false, { transform: booleanAttribute });

	/** Whether the card is drawn. Off leaves the behaviour and lets the consumer draw its own. */
	readonly overlay = input(true, { transform: booleanAttribute });

	/** The card's invitation. Falls back to the global file-input labels. */
	readonly dropText = input<string | null>(null);

	/** The card's second line. Falls back to the constraints, written out. */
	readonly dropSubtext = input<string | null>(null);

	/** The files that passed every constraint. Never emitted empty. */
	readonly filesDropped = output<File[]>();

	/** The files that did not, each with the reason and the limit it broke. */
	readonly rejected = output<HubFileRejection[]>();

	/** Whether a file drag is currently over the target. */
	readonly dragActive = signal(false);

	/**
	 * Enter and leave fire once per element the drag crosses, so a page full of children would
	 * flicker the card on every one of them. Counting depth is what makes it steady.
	 */
	#depth = 0;

	#overlayRef: ComponentRef<HubFileDropOverlayComponent> | null = null;

	constructor() {
		const destroyRef = inject(DestroyRef);

		if (!this.#isBrowser) {
			return;
		}

		// Re-bound whenever the scope changes: the same directive watching a container and watching
		// the window are two different sets of listeners, and leaving the old ones attached would
		// keep a card alive over a page that no longer asked for one.
		effect((onCleanup) => {
			const target: EventTarget = this.hubFileDrop() === 'window' ? this.#document : this.#element.nativeElement;
			const stops = [
				this.#renderer.listen(target, 'dragenter', (event: DragEvent) => this.#onEnter(event)),
				this.#renderer.listen(target, 'dragover', (event: DragEvent) => this.#onOver(event)),
				this.#renderer.listen(target, 'dragleave', (event: DragEvent) => this.#onLeave(event)),
				this.#renderer.listen(target, 'drop', (event: DragEvent) => this.#onDrop(event))
			];

			onCleanup(() => stops.forEach((stop) => stop()));
		});

		effect(() => {
			if (!this.overlay()) {
				this.#destroyOverlay();
				return;
			}

			const overlay = this.#ensureOverlay();

			overlay.setInput('visible', this.dragActive());
			overlay.setInput('fixed', this.hubFileDrop() === 'window');
			overlay.setInput('text', this.dropText() ?? this.#config.fileInput.dropHere);
			overlay.setInput('subtext', this.dropSubtext() ?? this.#constraintsText());
		});

		destroyRef.onDestroy(() => this.#destroyOverlay());
	}

	/** Whether the zone takes files at all right now. */
	#enabled(): boolean {
		return !this.dropDisabled();
	}

	/**
	 * Raises the card, once, for a drag that actually carries files.
	 *
	 * @param event - The dragenter event.
	 */
	#onEnter(event: DragEvent): void {
		if (!this.#enabled() || !carriesFiles(event)) {
			return;
		}

		event.preventDefault();
		this.#depth++;
		this.dragActive.set(true);
	}

	/**
	 * Keeps the target alive. A `dragover` that does not call `preventDefault` refuses the drop —
	 * and on the window that refusal is what makes the browser open the file and lose the page.
	 *
	 * @param event - The dragover event.
	 */
	#onOver(event: DragEvent): void {
		if (!this.#enabled() || !carriesFiles(event)) {
			return;
		}

		event.preventDefault();

		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'copy';
		}
	}

	/**
	 * Lowers the card once the drag has left the target and every child of it.
	 *
	 * @param event - The dragleave event.
	 */
	#onLeave(event: DragEvent): void {
		if (!this.#enabled()) {
			return;
		}

		event.preventDefault();
		this.#depth = Math.max(0, this.#depth - 1);

		if (this.#depth === 0) {
			this.dragActive.set(false);
		}
	}

	/**
	 * Applies the constraints to what was dropped and publishes both halves of the answer.
	 *
	 * @param event - The drop event.
	 */
	#onDrop(event: DragEvent): void {
		if (!this.#enabled()) {
			return;
		}

		event.preventDefault();
		this.#depth = 0;
		this.dragActive.set(false);

		const accepted: File[] = [];
		const rejections: HubFileRejection[] = [];

		for (const file of extractFiles(event.dataTransfer)) {
			const rejection = this.#reject(file, accepted.length);

			if (rejection) {
				rejections.push(rejection);
			} else {
				accepted.push(file);
			}
		}

		if (accepted.length > 0) {
			this.filesDropped.emit(accepted);
		}

		if (rejections.length > 0) {
			this.rejected.emit(rejections);
		}
	}

	/**
	 * Checks one candidate against the declared constraints.
	 *
	 * @param file - The candidate.
	 * @param accepted - How many files of this drop have already passed.
	 * @returns The rejection, or `null` when the file passes.
	 */
	#reject(file: File, accepted: number): HubFileRejection | null {
		const build = (reason: HubFileRejectionReason, limit: string | number | null): HubFileRejection => ({
			file,
			reason,
			limit
		});

		if (!matchesAccept(file, this.accept())) {
			return build('accept', this.accept());
		}

		const minSize = this.minSize();

		if (minSize != null && file.size < minSize) {
			return build('minSize', minSize);
		}

		const maxSize = this.maxSize();

		if (maxSize != null && file.size > maxSize) {
			return build('maxSize', maxSize);
		}

		const maxFiles = this.maxFiles();

		if (maxFiles != null && accepted + 1 > maxFiles) {
			return build('maxFiles', maxFiles);
		}

		return null;
	}

	/** The restrictions written out, the same sentence a file field puts under its dropzone. */
	#constraintsText(): string {
		const accept = this.accept();

		return this.#config.fileInput.constraints({
			accept: !accept || accept === '*' || accept === '*/*' ? null : accept,
			maxSize: this.maxSize(),
			maxFiles: this.maxFiles()
		});
	}

	/**
	 * Creates the card and keeps it where it can cover the target: inside the host for a container,
	 * on the body for the window — a card appended to a scrolled container would scroll with it.
	 * The parent is re-checked on every pass, because the scope is an input and can change.
	 *
	 * @returns The card's component reference.
	 */
	#ensureOverlay(): ComponentRef<HubFileDropOverlayComponent> {
		this.#overlayRef ??= this.#viewContainer.createComponent(HubFileDropOverlayComponent);

		const node = this.#overlayRef.location.nativeElement as HTMLElement;
		const parent = this.hubFileDrop() === 'window' ? this.#document.body : (this.#element.nativeElement as HTMLElement);

		if (node.parentElement !== parent) {
			this.#renderer.appendChild(parent, node);
		}

		return this.#overlayRef;
	}

	/** Removes the card, node included — `ViewContainerRef` does not own where it was moved to. */
	#destroyOverlay(): void {
		if (!this.#overlayRef) {
			return;
		}

		const node = this.#overlayRef.location.nativeElement as HTMLElement;

		node.remove();
		this.#overlayRef.destroy();
		this.#overlayRef = null;
	}
}

/**
 * Reads a file count that may arrive as an attribute string, keeping `null` as "no limit".
 *
 * @param value - The bound value.
 * @returns The limit, or `null`.
 */
function toLimit(value: unknown): number | null {
	return value == null || value === '' ? null : numberAttribute(value);
}

/**
 * Whether a drag event carries files, as opposed to text or a page element.
 *
 * @param event - The drag event.
 * @returns `true` when the payload includes files.
 */
function carriesFiles(event: DragEvent): boolean {
	return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

/**
 * Extracts the files a drop carries, skipping the non-file payloads a page can also hold.
 *
 * @param transfer - The `DataTransfer` of the event.
 * @returns The files it carries.
 */
function extractFiles(transfer: DataTransfer | null): File[] {
	if (!transfer) {
		return [];
	}

	if (transfer.items?.length) {
		return Array.from(transfer.items)
			.filter((item) => item.kind === 'file')
			.map((item) => item.getAsFile())
			.filter((file): file is File => file !== null);
	}

	return Array.from(transfer.files ?? []);
}
