import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
	booleanAttribute,
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	ElementRef,
	inject,
	input,
	NgZone,
	OnChanges,
	OnInit,
	output,
	Renderer2,
	signal,
	SimpleChanges,
	TemplateRef,
	viewChild,
	ViewEncapsulation
} from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { animationFrameScheduler, asapScheduler, fromEvent } from 'rxjs';
import { auditTime } from 'rxjs/operators';
import { SelectPanelDomEvents } from './panel-dom-events';
import { OverlayRef } from 'ng-hub-ui-utils';
import { connectionPairToDropdownPosition, DROPDOWN_CSS_POSITIONS } from './panel-position';
import { SelectPanelService, PanelDimensions } from './select-panel.service';

import { DropdownPosition, SelectEngineOption } from '../types/select-engine.types';
import { isDefined } from '../utils/value-utils';

const SCROLL_SCHEDULER = typeof requestAnimationFrame !== 'undefined' ? animationFrameScheduler : asapScheduler;

/**
 * Renders, positions, and virtualizes the dropdown option panel.
 *
 * @since 3.0.0
 */
@Component({
	changeDetection: ChangeDetectionStrategy.OnPush,
	encapsulation: ViewEncapsulation.None,
	selector: 'hub-select-panel',
	template: `
		@if (headerTemplate()) {
			<div class="ng-dropdown-header hub-select__panel-header">
				<ng-container [ngTemplateOutlet]="headerTemplate()" [ngTemplateOutletContext]="{ searchTerm: filterValue() }" />
			</div>
		}
		<div
			#scroll
			role="listbox"
			class="ng-dropdown-panel-items hub-select__panel-items scroll-host"
			[attr.id]="listboxId()"
			[attr.aria-label]="ariaLabelDropdown()"
		>
			<div #padding [class.total-padding]="virtualScroll()"></div>
			<div #content [class.scrollable-content]="virtualScroll() && items().length" [style.transform]="contentTransform()">
				<ng-content />
			</div>
		</div>
		@if (footerTemplate()) {
			<div class="ng-dropdown-footer hub-select__panel-footer">
				<ng-container [ngTemplateOutlet]="footerTemplate()" [ngTemplateOutletContext]="{ searchTerm: filterValue() }" />
			</div>
		}
	`,
	imports: [NgTemplateOutlet]
})
export class HubSelectPanelComponent implements OnInit, OnChanges {
	readonly items = input<SelectEngineOption[]>([]);
	readonly showAddTag = input(false, { transform: booleanAttribute });
	readonly markedItem = input<SelectEngineOption | undefined>(undefined);
	readonly position = input<DropdownPosition>('auto');
	readonly bufferAmount = input<number | undefined>(undefined);
	readonly virtualScroll = input(false, { transform: booleanAttribute });
	readonly headerTemplate = input<TemplateRef<any> | undefined>(undefined);
	readonly footerTemplate = input<TemplateRef<any> | undefined>(undefined);
	readonly filterValue = input<string | null>(null);
	readonly ariaLabelDropdown = input<string | null>(null);
	readonly listboxId = input<string | null>(null);
	/**
	 * Which DOM event to listen to for outside click detection
	 */
	readonly outsideClickEvent = input<'click' | 'mousedown'>('click');
	/** Close the dropdown when the page or an ancestor container scrolls. */
	readonly closeOnScroll = input(false, { transform: booleanAttribute });
	/** @deprecated Has no effect: the overlay renders in the native Popover API top layer automatically in supporting browsers. Will be removed in a future major version. */
	readonly popover = input(false, { transform: booleanAttribute });
	/** Overlay hosting this panel. Used to request repositioning when the rendered content changes. */
	readonly overlayRef = input<OverlayRef | null>(null);
	/** Element the list lines up with (the control, or what `dropdownAnchor` returns). Its width is the list's minimum. */
	readonly originElement = input<HTMLElement | null>(null);
	/** Host `hub-select-engine` element. The panel's DOM lives in the overlay, so the host cannot be derived from the DOM tree. */
	readonly selectElement = input<HTMLElement | undefined>(undefined);
	readonly update = output<any[]>();
	readonly scroll = output<{
		start: number;
		end: number;
	}>();
	readonly scrollToEnd = output<void>();
	readonly outsideClick = output<void>();
	readonly outsideScroll = output<void>();
	private _renderer = inject(Renderer2);
	private _zone = inject(NgZone);
	private _panelService = inject(SelectPanelService);
	private _document = inject(DOCUMENT, { optional: true })!;
	private _destroyRef = inject(DestroyRef);
	private _dropdown = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
	private readonly contentElementRef = viewChild<string, ElementRef<HTMLElement>>('content', { read: ElementRef });
	private readonly scrollElementRef = viewChild<string, ElementRef<HTMLElement>>('scroll', { read: ElementRef });
	private readonly paddingElementRef = viewChild<string, ElementRef<HTMLElement>>('padding', { read: ElementRef });

	private readonly _virtualPadding = computed(() => this.paddingElementRef()?.nativeElement);
	private readonly _scrollablePanel = computed(() => this.scrollElementRef()?.nativeElement);
	private readonly _contentPanel = computed(() => this.contentElementRef()?.nativeElement);

	/** Offset of the rendered virtual-scroll range. Template-bound so it renders in the same pass as the range's rows (#2899). */
	protected readonly contentTransform = signal<string | null>(null);

	private _select: HTMLElement | undefined;
	private _scrollToEndFired = false;
	private _updateScrollHeight = false;
	private _lastScrollPosition = 0;

	private _currentPosition: DropdownPosition | undefined;

	/**
	 * Gets the panel position selected by the overlay strategy.
	 *
	 * @returns The current position.
	 *
	 * @since 3.0.0
	 */
	get currentPosition(): DropdownPosition | undefined {
		return this._currentPosition;
	}

	// -1 never equals a real length, so the first assignment always counts as a change.
	private _itemsLength = -1;

	/**
	 * Gets the number of rows available to the panel.
	 *
	 * @returns The items length.
	 *
	 * @since 3.0.0
	 */
	private get itemsLength() {
		return this._itemsLength;
	}

	/**
	 * Updates the cached item count and resets dependent virtual-scroll state.
	 *
	 * @param value - The value to process.
	 *
	 * @since 3.0.0
	 */
	private set itemsLength(value: number) {
		if (value !== this._itemsLength) {
			this._itemsLength = value;
			this._onItemsLengthChanged();
		}
	}

	/**
	 * Gets the rendered range’s starting vertical offset.
	 *
	 * @returns The start offset.
	 *
	 * @since 3.0.0
	 */
	private get _startOffset() {
		if (this.markedItem()) {
			const { panelHeight } = this._panelService.dimensions;
			const offset = this._panelService.getItemOffset(this.items(), this.markedItem()?.index ?? 0);
			return panelHeight > offset ? 0 : offset;
		}
		return 0;
	}

	/**
	 * Initializes the instance after Angular has assigned its inputs.
	 *
	 * @since 3.0.0
	 */
	ngOnInit() {
		// The panel is always created inside a select host, so the parent exists here.
		this._select = this.selectElement() ?? this._dropdown.parentElement!;
		this._handleScroll();
		new SelectPanelDomEvents({
			closeOnScroll: this.closeOnScroll(),
			destroyRef: this._destroyRef,
			document: this._document,
			dropdown: this._dropdown,
			onOutsideClick: () => this.outsideClick.emit(),
			onOutsideScroll: () => this.outsideScroll.emit(),
			outsideClickEvent: this.outsideClickEvent() ?? 'click',
			origin: this.originElement(),
			overlayRef: this.overlayRef(),
			select: this._select,
			zone: this._zone
		}).start();
		this._subscribeOverlayPosition();
	}

	/**
	 * Responds to Angular input changes.
	 *
	 * @param changes - The changed Angular inputs.
	 *
	 * @since 3.0.0
	 */
	ngOnChanges(changes: SimpleChanges) {
		if (changes['items']) {
			const change = changes['items'];
			this._onItemsOrShowAddTagChange(change.currentValue, this.showAddTag(), change.firstChange);
		}
		if (changes['showAddTag']) {
			const change = changes['showAddTag'];
			this._onItemsOrShowAddTagChange(this.items(), change.currentValue, change.firstChange);
		}
	}

	/**
	 * Scrolls until the requested option is visible.
	 *
	 * @param option - The option to process.
	 * @param startFromOption - The start from option.
	 *
	 * @since 3.0.0
	 */
	scrollTo(option: SelectEngineOption | undefined, startFromOption = false) {
		if (!option || this._destroyRef.destroyed) {
			return;
		}

		const index = this.items().indexOf(option);
		if (index < 0 || index >= this.itemsLength) {
			return;
		}

		let scrollTo: number | null;
		if (this.virtualScroll()) {
			const items = this.items();
			const itemHeight = this._panelService.getItemHeight(option);
			const itemTop = this._panelService.getItemOffset(items, index);
			scrollTo = this._panelService.getScrollTo(itemTop, itemHeight, this._lastScrollPosition);
		} else {
			const item = this._dropdown.querySelector<HTMLElement>(`#${option.htmlId}`);
			if (!item) {
				return;
			}
			const lastScroll = startFromOption ? item.offsetTop : this._lastScrollPosition;
			scrollTo = this._panelService.getScrollTo(item.offsetTop, item.clientHeight, lastScroll);
		}

		if (isDefined(scrollTo)) {
			const panel = this._scrollablePanel();
			if (panel) {
				panel.scrollTop = scrollTo;
			}
			// Programmatic scrollTop may not emit `scroll` in time; sync the range now (#2744)
			if (this.virtualScroll()) {
				this._onContentScrolled(scrollTo);
			} else {
				this._lastScrollPosition = scrollTo;
			}
		}
	}

	/**
	 * Scrolls to the add-tag row.
	 *
	 * @since 3.0.0
	 */
	scrollToTag() {
		const panel = this._scrollablePanel();
		if (!panel) {
			return;
		}
		panel.scrollTop = panel.scrollHeight - panel.clientHeight;
	}

	/**
	 * Requests that the overlay strategy recalculate the panel position.
	 *
	 * @since 3.0.0
	 */
	adjustPosition() {
		this.overlayRef()?.updatePosition();
	}

	/**
	 * Applies the position chosen by the overlay's position strategy to the panel and host
	 * as `hub-select__panel--top` / `--bottom` (and `--left` / `--right`) classes, which the
	 * shipped themes use for borders, radius and spacing.
	 *
	 * @since 23.7.0
	 */
	private _setCurrentPosition(position: DropdownPosition) {
		this._currentPosition = position;
		if (DROPDOWN_CSS_POSITIONS.includes(position)) {
			this._updateDropdownClass(position);
		} else {
			this._updateDropdownClass('bottom');
		}
	}

	/**
	 * Positions the freshly rendered panel. The overlay measures the real DOM, so header and
	 * footer templates and the actual item count are part of the auto placement decision
	 * (#2575). Only then is the panel made visible to avoid a flash at a stale position.
	 *
	 * @since 23.7.0
	 */
	private _positionDropdown() {
		const overlayRef = this.overlayRef();
		if (overlayRef) {
			// Apply position and emit positionChanges before the panel is visible
			overlayRef.updatePosition();
		} else if (!isDefined(this._currentPosition)) {
			// Standalone usage without an overlay: reflect the configured side directly
			this._setCurrentPosition(this.position() === 'auto' ? 'bottom' : this.position());
		}

		this._dropdown.style.opacity = '1';
	}

	/**
	 * Subscribes to overlay position changes.
	 *
	 * @since 23.7.0
	 */
	private _subscribeOverlayPosition() {
		// The overlay is disposed together with this panel, so the callback never outlives it.
		this.overlayRef()
			?.getConfig()
			.positionStrategy?.onPositionChange((position) =>
				this._setCurrentPosition(connectionPairToDropdownPosition(position))
			);
	}

	/**
	 * Updates the position-specific CSS class on the panel.
	 *
	 * @param currentPosition - The current position.
	 *
	 * @since 7.4.0
	 */
	private _updateDropdownClass(currentPosition: string) {
		DROPDOWN_CSS_POSITIONS.forEach((position) => {
			this._renderer.removeClass(this._dropdown, `ng-select-${position}`);
			this._renderer.removeClass(this._dropdown, `hub-select__panel--${position}`);
			this._renderer.removeClass(this._select, `ng-select-${position}`);
			this._renderer.removeClass(this._select, `hub-select__control--${position}`);
		});

		// The `ng-select-*` names are kept until 23.0.0 so consumer stylesheets keep matching.
		this._renderer.addClass(this._dropdown, `ng-select-${currentPosition}`);
		this._renderer.addClass(this._dropdown, `hub-select__panel--${currentPosition}`);
		this._renderer.addClass(this._select, `ng-select-${currentPosition}`);
		this._renderer.addClass(this._select, `hub-select__control--${currentPosition}`);
	}

	/**
	 * Subscribes to panel scrolling outside Angular change detection.
	 *
	 * @since 3.0.0
	 */
	private _handleScroll() {
		this._zone.runOutsideAngular(() => {
			const scrollablePanel = this._scrollablePanel();
			if (!scrollablePanel) {
				return;
			}
			fromEvent(scrollablePanel, 'scroll')
				.pipe(auditTime(0, SCROLL_SCHEDULER), takeUntilDestroyed(this._destroyRef))
				.subscribe(() => {
					this._onContentScrolled(scrollablePanel.scrollTop);
				});
		});
	}

	/**
	 * Refreshes rendered items when options or add-tag visibility changes.
	 *
	 * @param items - The options to process.
	 * @param showAddTag - The show add tag.
	 * @param firstChange - The first change.
	 *
	 * @since 20.6.2
	 */
	private _onItemsOrShowAddTagChange(items: SelectEngineOption[] = [], showAddTag: boolean, firstChange: boolean) {
		this._scrollToEndFired = false;
		this.itemsLength = items.length;
		if (showAddTag && items.length) {
			this.itemsLength++;
		}

		if (this.virtualScroll()) {
			this._updateItemsRange(firstChange);
		} else {
			this._setVirtualHeight();
			this._updateItems(firstChange);
		}
	}

	/**
	 * Rebuilds the rendered option collection and virtual-scroll measurements.
	 *
	 * @param firstChange - The first change.
	 *
	 * @since 3.0.0
	 */
	private _updateItems(firstChange: boolean) {
		this.update.emit(this.items());

		this._zone.runOutsideAngular(() => {
			Promise.resolve().then(() => {
				if (this._destroyRef.destroyed) {
					return;
				}
				// Panel may have opened empty; refresh height for scrollTo math (#2744)
				this._syncPanelHeightFromDom();
				if (!firstChange) {
					// Re-anchor so a top-placed panel grows upward and `auto` can flip (#2092)
					this.overlayRef()?.updatePosition();
					return;
				}
				this._positionDropdown();
				this.scrollTo(this.markedItem(), firstChange);
			});
		});
	}

	/**
	 * Recalculates the rendered virtual-scroll range.
	 *
	 * @param firstChange - The first change.
	 *
	 * @since 3.0.0
	 */
	private _updateItemsRange(firstChange: boolean) {
		this._zone.runOutsideAngular(() => {
			this._measureDimensions().then(() => {
				if (this._destroyRef.destroyed) {
					return;
				}
				const scrollTop = firstChange ? this._startOffset : (this._scrollablePanel()?.scrollTop ?? 0);
				if (!firstChange) {
					// Items changed at an unchanged scrollTop; bypass the same-position guard (#2880)
					this._lastScrollPosition = -1;
				}
				this._renderItemsRange(scrollTop);
				if (!firstChange) {
					this._lastScrollPosition = scrollTop;
				}

				// Sync panelHeight after the first paint; re-render if viewport capacity grew (#2744)
				const itemsPerViewportBefore = this._panelService.dimensions.itemsPerViewport;
				this._syncPanelHeightFromDom();
				if (this._panelService.dimensions.itemsPerViewport !== itemsPerViewportBefore) {
					const currentScrollTop = this._scrollablePanel()?.scrollTop ?? scrollTop;
					this._lastScrollPosition = -1;
					this._renderItemsRange(currentScrollTop);
					this._lastScrollPosition = currentScrollTop;
				}

				if (firstChange) {
					this._positionDropdown();
				} else {
					this.overlayRef()?.updatePosition();
				}
			});
		});
	}

	/**
	 * Updates cached panelHeight from the live scrollport, preserving row-height measurements.
	 *
	 * @since 23.9.0
	 */
	private _syncPanelHeightFromDom() {
		const panel = this._scrollablePanel();
		if (!panel) {
			return;
		}
		const panelHeight = panel.clientHeight;
		if (panelHeight <= 0) {
			return;
		}
		const { itemHeight, groupHeight } = this._panelService.dimensions;
		this._panelService.setDimensions(itemHeight, panelHeight, groupHeight);
	}

	/**
	 * Updates virtual-scroll state for a new scroll position.
	 *
	 * @param scrollTop - The scroll top.
	 *
	 * @since 3.0.0
	 */
	private _onContentScrolled(scrollTop: number) {
		if (this.virtualScroll()) {
			this._renderItemsRange(scrollTop);
		}
		this._lastScrollPosition = scrollTop;
		this._fireScrollToEnd(scrollTop);
	}

	/**
	 * Updates the virtual-scroll spacer height.
	 *
	 * @param height - The height.
	 *
	 * @since 3.0.0
	 */
	private _updateVirtualHeight(height: number) {
		if (this._updateScrollHeight) {
			const padding = this._virtualPadding();
			if (padding) {
				padding.style.height = `${height}px`;
			}
			this._updateScrollHeight = false;
		}
	}

	/**
	 * Measures and applies the virtual-scroll spacer height.
	 *
	 * @since 5.0.1
	 */
	private _setVirtualHeight() {
		const padding = this._virtualPadding();
		if (!padding) {
			return;
		}

		padding.style.height = `0px`;
	}

	/**
	 * Resets virtual-scroll state after the item count changes.
	 *
	 * @since 3.0.0
	 */
	private _onItemsLengthChanged() {
		this._updateScrollHeight = true;
	}

	/**
	 * Renders the virtual-scroll range for the current scroll position.
	 *
	 * @param scrollTop - The scroll top.
	 *
	 * @since 3.0.0
	 */
	private _renderItemsRange(scrollTop: number | null = null) {
		if (scrollTop && this._lastScrollPosition === scrollTop) {
			return;
		}

		const scrollablePanel = this._scrollablePanel();
		const contentPanel = this._contentPanel();
		if (!scrollablePanel || !contentPanel) {
			return;
		}

		scrollTop = scrollTop || scrollablePanel.scrollTop;
		const range = this._panelService.calculateItems(scrollTop, this.itemsLength, this.bufferAmount() ?? 0, this.items());
		this._updateVirtualHeight(range.scrollHeight);
		this.contentTransform.set(`translateY(${range.topPadding}px)`);

		// Outputs must stay template-bound: the template listener schedules CD under zoneless
		this._zone.run(() => {
			this.update.emit(this.items().slice(range.start, range.end));
			this.scroll.emit({ start: range.start, end: range.end });
		});

		if (isDefined(scrollTop) && this._lastScrollPosition === 0) {
			scrollablePanel.scrollTop = scrollTop;
			this._lastScrollPosition = scrollTop;
		}
	}

	/**
	 * Measures option, group, and viewport dimensions after rendering.
	 *
	 * @returns The measure dimensions result.
	 *
	 * @since 3.0.0
	 */
	private _measureDimensions(): Promise<PanelDimensions> {
		if (this._panelService.dimensions.itemHeight > 0 || this.itemsLength === 0) {
			return Promise.resolve(this._panelService.dimensions);
		}

		const items = this.items();
		const firstGroup = items.find((item) => !!item.children);
		const firstOption = items.find((item) => !item.children);
		const toMeasure = [firstGroup, firstOption].filter((item): item is SelectEngineOption => !!item);
		if (toMeasure.length === 0) {
			return Promise.resolve(this._panelService.dimensions);
		}

		// Emitted items render in the same CD pass; measure both a group and an option (#2762)
		this._zone.run(() => this.update.emit(toMeasure));

		return Promise.resolve()
			.then(() => this._readMeasuredDimensions(items, firstOption, firstGroup))
			.then((dims) => {
				if (dims.itemHeight > 0) {
					return dims;
				}
				// Options may not have painted yet; retry once next frame (#2744)
				return new Promise<PanelDimensions>((resolve) => {
					requestAnimationFrame(() => {
						if (this._destroyRef.destroyed) {
							resolve(this._panelService.dimensions);
							return;
						}
						this._zone.run(() => this.update.emit(toMeasure));
						Promise.resolve().then(() => resolve(this._readMeasuredDimensions(items, firstOption, firstGroup)));
					});
				});
			});
	}

	/**
	 * Reads option, group, and viewport dimensions from rendered elements.
	 *
	 * @param items - The options to process.
	 * @param firstOption - The first option.
	 * @param firstGroup - The first group.
	 * @returns The read measured dimensions result.
	 *
	 * @since 23.9.0
	 */
	private _readMeasuredDimensions(
		items: SelectEngineOption[],
		firstOption: SelectEngineOption | undefined,
		firstGroup: SelectEngineOption | undefined
	): PanelDimensions {
		const optionEl = firstOption ? this._dropdown.querySelector<HTMLElement>(`#${firstOption.htmlId}`) : null;
		const groupEl = firstGroup ? this._dropdown.querySelector<HTMLElement>(`#${firstGroup.htmlId}`) : null;
		if (!optionEl && !groupEl) {
			return this._panelService.dimensions;
		}

		const measuredOptionHeight = optionEl?.offsetHeight ?? 0;
		const measuredGroupHeight = groupEl?.offsetHeight ?? 0;
		const optionHeight = measuredOptionHeight || measuredGroupHeight;
		const groupHeight = measuredGroupHeight || measuredOptionHeight;

		const panelHeight = this._scrollablePanel()?.clientHeight ?? 0;
		this._panelService.setDimensions(optionHeight, panelHeight, groupHeight);
		const padding = this._virtualPadding();
		if (padding) {
			padding.style.height = `${this._panelService.getScrollHeight(items)}px`;
		}

		return this._panelService.dimensions;
	}

	/**
	 * Emits `scrollToEnd` once the viewport reaches the end of the content.
	 *
	 * @param scrollTop - The scroll top.
	 *
	 * @since 3.0.0
	 */
	private _fireScrollToEnd(scrollTop: number) {
		if (this._scrollToEndFired || scrollTop === 0) {
			return;
		}

		const padding = this.virtualScroll() ? this._virtualPadding() : this._contentPanel();

		if (padding && scrollTop + this._dropdown.clientHeight >= padding.clientHeight - 1) {
			this._zone.run(() => this.scrollToEnd.emit());
			this._scrollToEndFired = true;
		}
	}
}
