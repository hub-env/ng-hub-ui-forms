// @ts-nocheck -- vendored ng-select source (type-checked upstream); see ../PATCHES.md
import { Injector, TemplateRef, ViewContainerRef } from '@angular/core';
import { OverlayRef, OverlayService } from 'ng-hub-ui-utils';

import { DropdownPosition } from '../types/ng-select.types';
import { DROPDOWN_POSITIONS } from './dropdown-position';

/**
 * Describes the state required to open and position an ng-select dropdown overlay.
 *
 * @since 24.0.5
 */
export interface DropdownOverlayOpenRequest {
	appendTo: string | null;
	beforeAttach?: (overlayRef: OverlayRef) => void;
	origin: HTMLElement;
	position: DropdownPosition;
	template: TemplateRef<unknown>;
	viewContainer: ViewContainerRef;
}

/**
 * Owns the overlay used by one ng-select instance.
 *
 * The overlay is created on open and disposed on close, which destroys the panel with it: the
 * panel's subscriptions (outside click, scroll, resize) and its first-render work must not outlive
 * the open list.
 *
 * @since 24.0.5
 */
export class DropdownOverlayManager {
	overlayRef: OverlayRef | null = null;

	private panel: HTMLElement | null = null;

	/**
	 * Creates an instance of DropdownOverlayManager.
	 *
	 * @param injector - The injector.
	 * @param document - The document.
	 * @param selectElement - The select element.
	 *
	 * @since 24.0.5
	 */
	constructor(
		private readonly injector: Injector,
		private readonly document: Document,
		private readonly selectElement: HTMLElement,
	) {}

	/**
	 * Opens the dropdown panel.
	 *
	 * @param request - The request.
	 * @returns The attached overlay reference.
	 *
	 * @since 24.0.5
	 */
	open(request: DropdownOverlayOpenRequest): OverlayRef {
		if (this.overlayRef?.hasAttached()) {
			this.sizeToOrigin(request.origin);
			this.overlayRef.updatePosition();
			return this.overlayRef;
		}

		// Resolved on each open so a selector keeps working when its matching element is replaced.
		const host = request.appendTo ? this.resolveAppendToHost(request.appendTo) : undefined;
		const overlays = this.injector.get(OverlayService);
		const positionStrategy = overlays
			.position()
			.flexibleConnectedTo(request.origin)
			.withPositions([...(DROPDOWN_POSITIONS[request.position] ?? DROPDOWN_POSITIONS.auto)]);
		const overlayRef = overlays.create({
			positionStrategy,
			host,
			// Painted above any z-index, so the list shows over a modal with no stacking tuning.
			topLayer: true,
		});
		this.overlayRef = overlayRef;

		// The parent binds this reference into the panel, so publish it before attachment.
		request.beforeAttach?.(overlayRef);
		this.panel = overlayRef.attach(request.template, request.viewContainer);
		this.sizeToOrigin(request.origin);
		overlayRef.updatePosition();
		return overlayRef;
	}

	/**
	 * Closes the dropdown panel and releases its overlay.
	 *
	 * @since 24.0.5
	 */
	close(): void {
		this.overlayRef?.dispose();
		this.overlayRef = null;
		this.panel = null;
	}

	/**
	 * Disposes the owned overlay resources.
	 *
	 * @since 24.0.5
	 */
	destroy(): void {
		this.close();
	}

	/**
	 * Makes the list at least as wide as the element it lines up with. A minimum, not a width: the
	 * list may grow to its options (capped by the theme's max-width).
	 *
	 * @param origin - The element the list lines up with.
	 *
	 * @since 24.0.5
	 */
	private sizeToOrigin(origin: HTMLElement): void {
		if (this.panel) {
			this.panel.style.minWidth = `${origin.getBoundingClientRect().width}px`;
		}
	}

	/**
	 * Resolves the configured `appendTo` selector within the select root.
	 *
	 * @param selector - The CSS selector to resolve.
	 * @returns The element matching the selector.
	 *
	 * @since 24.0.5
	 */
	private resolveAppendToHost(selector: string): HTMLElement {
		const root = this.selectElement.getRootNode();
		const scope = typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot ? root : this.document;
		const host = scope.querySelector<HTMLElement>(selector);
		if (!host) {
			throw new Error(`appendTo selector ${selector} did not found any parent element`);
		}
		return host;
	}
}
