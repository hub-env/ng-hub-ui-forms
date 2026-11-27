import { DOCUMENT } from '@angular/common';
import {
	afterEveryRender,
	AfterViewInit,
	booleanAttribute,
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	computed,
	contentChild,
	contentChildren,
	DestroyRef,
	effect,
	ElementRef,
	forwardRef,
	HostAttributeToken,
	HostListener,
	inject,
	InjectionToken,
	Injector,
	input,
	linkedSignal,
	model,
	numberAttribute,
	OnChanges,
	OnInit,
	output,
	Renderer2,
	signal,
	SimpleChanges,
	TemplateRef,
	untracked,
	viewChild,
	ViewContainerRef,
	ViewEncapsulation
} from '@angular/core';
import { EventPhase } from '@angular/core/primitives/event-dispatch';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, filter, map, tap } from 'rxjs/operators';

import {
	NgClearButtonTemplateDirective,
	NgFooterTemplateDirective,
	NgHeaderTemplateDirective,
	NgLabelTemplateDirective,
	NgLoadingSpinnerTemplateDirective,
	NgLoadingTextTemplateDirective,
	NgMultiLabelTemplateDirective,
	NgNotFoundTemplateDirective,
	NgOptgroupTemplateDirective,
	NgOptionTemplateDirective,
	NgPlaceholderTemplateDirective,
	NgTagTemplateDirective,
	NgTypeToSearchTemplateDirective
} from '../directives/engine-templates.directive';

import { NgClass, NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OverlayRef } from 'ng-hub-ui-utils';
import { SelectPanelOverlayManager } from '../select-panel/panel-overlay-manager';
import { ClassValue, mergeClassValues, readConsumerHostClasses } from '../select-panel/panel-classes';
import { HubSelectPanelComponent } from '../select-panel/select-panel.component';
import { SelectPanelService } from '../select-panel/select-panel.service';
import { ItemsList } from '../items-list';
import { HubOptionComponent } from '../option.component';
import { DefaultSelectionModelFactory, SelectionModelFactory } from '../selection-model';
import { HubSelectConfig } from '../services/select-config.service';
import { ConsoleService } from '../services/console.service';
import { newId } from '../types/id';
import { DropdownPosition, KeyCode, SelectEngineOption } from '../types/select-engine.types';
import { isDefined, isFunction, isObject, isPromise } from '../utils/value-utils';
import { createUnmatchedOptionValue, selectedItemsToModel, validateWriteValue } from './select-engine-model-value';

/** DI token for SelectionModel implementation. You can provide custom implementation changing selection behaviour. */
export const SELECTION_MODEL_FACTORY = new InjectionToken<SelectionModelFactory>('ng-select-selection-model');
export type AddTagFn = (term: string) => any | Promise<any>;
export type CompareWithFn = (a: any, b: any) => boolean;
export type GroupValueFn = (key: string | any, children: any[]) => string | any;
/** Custom templates the engine can render, each receiving the same context as its `ng-*-tmp` directive. */
export interface HubSelectEngineTemplates {
	option?: TemplateRef<any> | null;
	optgroup?: TemplateRef<any> | null;
	label?: TemplateRef<any> | null;
	multiLabel?: TemplateRef<any> | null;
	header?: TemplateRef<any> | null;
	footer?: TemplateRef<any> | null;
	notFound?: TemplateRef<any> | null;
	typeToSearch?: TemplateRef<any> | null;
	loadingText?: TemplateRef<any> | null;
	tag?: TemplateRef<any> | null;
	loadingSpinner?: TemplateRef<any> | null;
	clearButton?: TemplateRef<any> | null;
}

/**
 * Transforms an optional attribute value while preserving `undefined`.
 *
 * @param value - The value to process.
 * @returns The optional boolean attribute result.
 *
 * @since 22.0.0
 */
function optionalBooleanAttribute(value: unknown): boolean | undefined {
	return value == null ? undefined : booleanAttribute(value);
}

/**
 * Provides select, multiselect, autocomplete, keyboard, accessibility, and Signal, Reactive, and Template-driven Forms behavior.
 *
 * @since 3.0.0
 */
@Component({
	selector: 'hub-select-engine',
	exportAs: 'hubSelectEngine',
	templateUrl: './select-engine.component.html',
	styleUrls: ['./select-engine.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => HubSelectEngineComponent),
			multi: true
		},
		SelectPanelService
	],
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgClass, NgTemplateOutlet, HubSelectPanelComponent],
	host: {
		'[class.ng-select]': 'true',
		'[class.hub-select__control]': 'true',
		'[class.ng-select-single]': '!multiple()',
		'[class.ng-select-typeahead]': 'typeahead()',
		'[class.ng-select-multiple]': 'multiple()',
		'[class.ng-select-taggable]': 'addTag()',
		'[class.ng-select-searchable]': 'searchable()',
		'[class.ng-select-clearable]': 'clearable()',
		'[class.ng-select-filtered]': 'filtered',
		'[class.ng-select-disabled]': 'disabled()',
		// The `.ng-*` names above are kept until 23.0.0 so consumer stylesheets keep matching;
		// the library itself only styles the `hub-select__*` names.
		'[class.hub-select__control--single]': '!multiple()',
		'[class.hub-select__control--typeahead]': 'typeahead()',
		'[class.hub-select__control--multiple]': 'multiple()',
		'[class.hub-select__control--taggable]': 'addTag()',
		'[class.hub-select__control--searchable]': 'searchable()',
		'[class.hub-select__control--clearable]': 'clearable()',
		'[class.hub-select__control--filtered]': 'filtered',
		'[class.hub-select__control--disabled]': 'disabled()'
	}
})
export class HubSelectEngineComponent implements OnChanges, OnInit, AfterViewInit, ControlValueAccessor {
	readonly classes = inject(new HostAttributeToken('class'), { optional: true });
	readonly config = inject(HubSelectConfig);
	// signals
	public readonly _disabled = signal<boolean>(false);
	// inputs: underscored input() + alias + linkedSignal() for stable public names (back compat)
	/** Placeholder text. */
	readonly _placeholder = input<string | undefined>(this.config.placeholder, { alias: 'placeholder' });
	readonly placeholder = linkedSignal(() => this._placeholder());
	/** Set placeholder visible even when an item is selected */
	readonly _fixedPlaceholder = input<boolean>(this.config.fixedPlaceholder, { alias: 'fixedPlaceholder' });
	readonly fixedPlaceholder = linkedSignal(() => this._fixedPlaceholder());
	/** Set custom text when filter returns empty result */
	readonly _notFoundText = input<string | undefined>(undefined, { alias: 'notFoundText' });
	readonly notFoundText = linkedSignal(() => this._notFoundText());
	/** Set custom text when using tagging */
	readonly _addTagText = input<string | undefined>(undefined, { alias: 'addTagText' });
	readonly addTagText = linkedSignal(() => this._addTagText());
	/**
	 * Append the dropdown overlay to any element using a css selector, resolved against the
	 * select's own root (document or shadow root). The panel keeps its viewport-based
	 * positioning and top-layer painting; the target controls where the overlay lives in the
	 * DOM — ancestor-scoped styles, stacking context and focus containment. Defaults to the
	 * document body.
	 */
	readonly _appendTo = input<string | undefined>(undefined, { alias: 'appendTo' });
	readonly appendTo = linkedSignal(() => this._appendTo());
	/** You can set the loading state from the outside (e.g. async items loading) */
	readonly _loading = input(false, { alias: 'loading', transform: booleanAttribute });
	readonly loading = linkedSignal(() => this._loading());
	/** Whether to close the menu when a value is selected */
	readonly _closeOnSelect = input(true, { alias: 'closeOnSelect', transform: booleanAttribute });
	readonly closeOnSelect = linkedSignal(() => this._closeOnSelect());
	/** Allows to hide selected items. */
	readonly _hideSelected = input(false, { alias: 'hideSelected', transform: booleanAttribute });
	readonly hideSelected = linkedSignal(() => this._hideSelected());
	/** When multiple = true, allows to set a limit number of selection. */
	readonly _maxSelectedItems = input<number, unknown>(undefined, { alias: 'maxSelectedItems', transform: numberAttribute });
	readonly maxSelectedItems = linkedSignal(() => this._maxSelectedItems());
	/** Allow to group items by key or function expression */
	readonly _groupBy = input<string | ((value: any) => any)>(undefined, { alias: 'groupBy' });
	readonly groupBy = linkedSignal(() => this._groupBy());
	/** Function expression to provide group value */
	readonly _groupValue = input<GroupValueFn>(undefined, { alias: 'groupValue' });
	readonly groupValue = linkedSignal(() => this._groupValue());
	/** Used in virtual scrolling, the `bufferAmount` property controls the number of items preloaded in the background to ensure smoother and more seamless scrolling. */
	readonly _bufferAmount = input(4, { alias: 'bufferAmount', transform: numberAttribute });
	readonly bufferAmount = linkedSignal(() => this._bufferAmount());
	/** Enable virtual scroll for better performance when rendering a lot of data */
	readonly _virtualScroll = input<boolean | undefined, unknown>(undefined, {
		alias: 'virtualScroll',
		transform: optionalBooleanAttribute
	});
	readonly virtualScroll = linkedSignal(() => this._virtualScroll());
	readonly dropdownVirtualScroll = computed(() => {
		const value = this._virtualScroll();
		return isDefined(value) ? value : this.isVirtualScrollDisabled(this.config);
	});
	/** Allow to select group when groupBy is used */
	readonly _selectableGroup = input(false, { alias: 'selectableGroup', transform: booleanAttribute });
	readonly selectableGroup = linkedSignal(() => this._selectableGroup());
	/** Indicates whether to select all children or group itself */
	readonly _selectableGroupAsModel = input(true, { alias: 'selectableGroupAsModel', transform: booleanAttribute });
	readonly selectableGroupAsModel = linkedSignal(() => this._selectableGroupAsModel());
	/** Allow to filter by custom search function */
	readonly _searchFn = input<((term: string, item: any) => boolean) | null>(null, { alias: 'searchFn' });
	readonly searchFn = linkedSignal(() => this._searchFn());
	/** Id to associate control with label. */
	readonly _labelForId = input<string | null>(null, { alias: 'labelForId' });
	readonly labelForId = linkedSignal(() => this._labelForId());
	/** Pass custom attributes to underlying `input` element */
	readonly _inputAttrs = input<Record<string, string>>({}, { alias: 'inputAttrs' });
	readonly inputAttrs = linkedSignal(() => this._inputAttrs());
	/** Prevent user changes while preserving the current selection. */
	readonly _readonly = input(false, { alias: 'readonly', transform: booleanAttribute });
	readonly readonly = linkedSignal(() => this._readonly());
	/** Minimum term length to start a search. Should be used with `typeahead` */
	readonly _minTermLength = input(0, { alias: 'minTermLength', transform: numberAttribute });
	readonly minTermLength = linkedSignal(() => this._minTermLength());
	/** Additional CSS classes applied to the dropdown panel. Merged with mirrored host `class` and `[class]` values. */
	readonly _panelClass = input<ClassValue | null>(null, { alias: 'panelClass' });
	readonly panelClass = linkedSignal(() => this._panelClass());
	/** Custom autocomplete or advanced filter. */
	readonly _typeahead = input<Subject<string>>(undefined, { alias: 'typeahead' });
	readonly typeahead = linkedSignal(() => this._typeahead());
	/** Allows to select multiple items. */
	readonly _multiple = input(false, { alias: 'multiple', transform: booleanAttribute });
	readonly multiple = linkedSignal(() => this._multiple());
	/** Allows to create custom options. */
	readonly _addTag = input<boolean | AddTagFn>(false, { alias: 'addTag' });
	readonly addTag = linkedSignal(() => this._addTag());
	/** Allow to search for value. Default `true` */
	readonly _searchable = input(true, { alias: 'searchable', transform: booleanAttribute });
	readonly searchable = linkedSignal(() => this._searchable());
	/** Allow to clear selected value. Default `true` */
	readonly _clearable = input(true, { alias: 'clearable', transform: booleanAttribute });
	readonly clearable = linkedSignal(() => this._clearable());
	/** Clears search input when item is selected. Default `true`. Default `false` when **closeOnSelect** is `false` */
	readonly _clearSearchOnAdd = input<boolean | undefined>(undefined, { alias: 'clearSearchOnAdd' });
	readonly clearSearchOnAdd = linkedSignal(() => this._clearSearchOnAdd());
	/** A function to compare the option values with the selected values. The first argument is a value from an option. The second is a value from the selection(model). A boolean should be returned. */
	readonly _compareWith = input<CompareWithFn | undefined, CompareWithFn | undefined>(undefined, {
		alias: 'compareWith',
		transform: (fn: CompareWithFn | undefined) => {
			if (fn !== undefined && fn !== null && !isFunction(fn)) {
				throw Error('`compareWith` must be a function.');
			}
			return fn;
		}
	});
	readonly compareWith = linkedSignal(() => this._compareWith());
	/**
	 * Custom templates handed over by the owning field. A content query cannot see through that
	 * field's own `<ng-content>`, so it passes them in directly; templates written inside the
	 * engine's own tags (`ng-*-tmp`) are the fallback.
	 */
	readonly templates = input<HubSelectEngineTemplates>({});
	/** Finds the element the open list lines up with instead of this control; asked each time the list opens. */
	readonly dropdownAnchor = input<(() => HTMLElement | null) | null>(null);
	// models
	/** Object property to use for label. Default `label` */
	readonly bindLabel = model<string | undefined>(undefined);
	/** Object property to use for selected model. By default binds to whole object. */
	readonly bindValue = model<string | undefined>(undefined);
	/** Allows manual control of dropdown opening and closing. `true` - won't close. `false` - won't open. */
	readonly isOpen = model<boolean | undefined>(false);
	/** Items array */
	readonly items = model<readonly any[]>([]);
	// output events
	/** Fired on select blur */
	readonly blurEvent = output<any>({ alias: 'blur' });
	/** Fired on select focus */
	readonly focusEvent = output<any>({ alias: 'focus' });
	/** Fired on model change. Outputs whole model */
	readonly changeEvent = output<any>({ alias: 'change' });
	/** Fired on select dropdown open */
	readonly openEvent = output({ alias: 'open' });
	/** Fired on select dropdown close */
	readonly closeEvent = output({ alias: 'close' });
	/** Fired while typing search term. Outputs search term with filtered items */
	readonly searchEvent = output<{
		term: string;
		items: any[];
	}>({ alias: 'search' });
	/** Fired on clear icon click */
	readonly clearEvent = output({ alias: 'clear' });
	/** Fired when item is added while `[multiple]="true"`. Outputs added item */
	readonly addEvent = output<any>({ alias: 'add' });
	/** Fired when item is removed while `[multiple]="true"` */
	readonly removeEvent = output<any>({ alias: 'remove' });
	/** Fired when scrolled (only when `[virtualScroll]="true"`). Provides the start and end index of the currently available items. Can be used for loading more items in chunks before the user has scrolled all the way to the bottom of the list. */
	readonly scroll = output<{
		start: number;
		end: number;
	}>({ alias: 'scroll' });
	/** Fired when scrolled to the end of items. Can be used for loading more items in chunks. */
	readonly scrollToEnd = output<any>({ alias: 'scrollToEnd' });
	// Read once: a partial config object supplied by a consumer may lack these two.
	readonly outsideClickEvent = this.config.outsideClickEvent ?? 'click';
	readonly closeOnScroll = this.config.closeOnScroll ?? false;
	// computed
	readonly disabled = computed(() => this.readonly() || this._disabled());
	readonly clearSearchOnAddValue = computed(() => {
		if (isDefined(this.clearSearchOnAdd())) {
			return this.clearSearchOnAdd();
		}
		if (isDefined(this.config.clearSearchOnAdd)) {
			return this.config.clearSearchOnAdd;
		}
		return this.closeOnSelect();
	});
	readonly deselectOnClickValue = computed(() => this.config.deselectOnClick ?? this.multiple());
	// content child queries
	private readonly _contentOptionTemplate = contentChild(NgOptionTemplateDirective, { read: TemplateRef });
	readonly optionTemplate = computed(() => this.templates().option ?? this._contentOptionTemplate());
	private readonly _contentOptgroupTemplate = contentChild(NgOptgroupTemplateDirective, { read: TemplateRef });
	readonly optgroupTemplate = computed(() => this.templates().optgroup ?? this._contentOptgroupTemplate());
	private readonly _contentLabelTemplate = contentChild(NgLabelTemplateDirective, { read: TemplateRef });
	readonly labelTemplate = computed(() => this.templates().label ?? this._contentLabelTemplate());
	private readonly _contentMultiLabelTemplate = contentChild(NgMultiLabelTemplateDirective, { read: TemplateRef });
	readonly multiLabelTemplate = computed(() => this.templates().multiLabel ?? this._contentMultiLabelTemplate());
	private readonly _contentHeaderTemplate = contentChild(NgHeaderTemplateDirective, { read: TemplateRef });
	readonly headerTemplate = computed(() => this.templates().header ?? this._contentHeaderTemplate());
	private readonly _contentFooterTemplate = contentChild(NgFooterTemplateDirective, { read: TemplateRef });
	readonly footerTemplate = computed(() => this.templates().footer ?? this._contentFooterTemplate());
	private readonly _contentNotFoundTemplate = contentChild(NgNotFoundTemplateDirective, { read: TemplateRef });
	readonly notFoundTemplate = computed(() => this.templates().notFound ?? this._contentNotFoundTemplate());
	private readonly _contentTypeToSearchTemplate = contentChild(NgTypeToSearchTemplateDirective, { read: TemplateRef });
	readonly typeToSearchTemplate = computed(() => this.templates().typeToSearch ?? this._contentTypeToSearchTemplate());
	private readonly _contentLoadingTextTemplate = contentChild(NgLoadingTextTemplateDirective, { read: TemplateRef });
	readonly loadingTextTemplate = computed(() => this.templates().loadingText ?? this._contentLoadingTextTemplate());
	private readonly _contentTagTemplate = contentChild(NgTagTemplateDirective, { read: TemplateRef });
	readonly tagTemplate = computed(() => this.templates().tag ?? this._contentTagTemplate());
	private readonly _contentLoadingSpinnerTemplate = contentChild(NgLoadingSpinnerTemplateDirective, { read: TemplateRef });
	readonly loadingSpinnerTemplate = computed(() => this.templates().loadingSpinner ?? this._contentLoadingSpinnerTemplate());
	private readonly _contentClearButtonTemplate = contentChild(NgClearButtonTemplateDirective, { read: TemplateRef });
	readonly clearButtonTemplate = computed(() => this.templates().clearButton ?? this._contentClearButtonTemplate());
	readonly placeholderTemplate = contentChild(NgPlaceholderTemplateDirective, { read: TemplateRef });
	readonly ngOptions = contentChildren(HubOptionComponent, { descendants: true });
	// view children queries
	readonly dropdownPanel = viewChild(forwardRef(() => HubSelectPanelComponent));
	readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
	readonly clearButton = viewChild<ElementRef<HTMLSpanElement>>('clearButton');
	private readonly _dropdownTemplate = viewChild<TemplateRef<any>>('dropdownTemplate');
	// The portal's embedded view is anchored at the template's own container so it stays
	// part of this component's logical view tree (DI, view queries, detectChanges) while
	// its DOM nodes live in the overlay
	private readonly _dropdownOutlet = viewChild('dropdownTemplate', { read: ViewContainerRef });
	private readonly _selectContainer = viewChild<ElementRef<HTMLDivElement>>('selectContainer');
	// public variables
	readonly dropdownId = newId();
	readonly element: HTMLElement;
	// variables
	itemsList: ItemsList;
	viewPortItems: SelectEngineOption[] = [];
	private readonly _cd = inject(ChangeDetectorRef);
	private readonly _console = inject(ConsoleService);
	private readonly _destroyRef = inject(DestroyRef);
	private readonly autoFocus = inject(new HostAttributeToken('autofocus'), { optional: true });
	/** Overlay hosting the dropdown panel while open. Bound into the panel so it can request repositioning. */
	protected dropdownOverlayRef: OverlayRef | null = null;
	/** Element the open list lines up with. Bound into the panel, which keeps its minimum width in step with it. */
	protected dropdownOrigin: HTMLElement | null = null;
	// private variables
	private readonly _defaultLabel = 'label';
	private readonly _document = inject(DOCUMENT);
	private _injector = inject(Injector);
	private readonly _dropdownOverlay: SelectPanelOverlayManager;
	private _isComposing = false;
	private _itemsAreUsed = false;
	private readonly _keyPress$ = new Subject<string>();
	private _manualOpen = false;
	private _pressedKeys: string[] = [];
	private _primitive: any;
	/** Last value written via `writeValue` or emitted via `_updateNgModel`; re-applied when mode/bindings change. */
	private _lastWrittenValue: any | any[] = null;
	private readonly _searchTerm = signal<string | null>(null);
	private readonly _validTerm = computed(() => {
		const term = this._searchTerm()?.trim();
		return term && term.length >= this.minTermLength();
	});
	/** Consumer classes on the host from static `class` and `[class]` bindings. */
	private readonly _consumerHostClasses = signal<string | null>(null);
	/** Classes forwarded to the overlay panel (mirrored host classes + `panelClass`). */
	readonly panelClasses = computed(() => {
		return mergeClassValues(
			// Preserve explicitly declared static classes even when they share a name with
			// a framework-managed class that is otherwise filtered from the observed host.
			this.classes,
			this._consumerHostClasses(),
			this.panelClass()
		);
	});

	/** Adds/removes `ng-select-opened` / `hub-select__control--opened` on the host — assigned in the constructor. */
	private _reflectOpenState!: (open: boolean) => void;

	/**
	 * Creates an instance of HubSelectEngineComponent.
	 *
	 * @since 3.0.0
	 */
	constructor() {
		const config = this.config;
		const newSelectionModel = inject<SelectionModelFactory | undefined>(SELECTION_MODEL_FACTORY, { optional: true });
		const _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
		const _renderer = inject(Renderer2);

		this._mergeGlobalConfig(config);
		this.itemsList = new ItemsList(this, newSelectionModel ? newSelectionModel() : DefaultSelectionModelFactory());
		this.element = _elementRef.nativeElement;
		this._dropdownOverlay = new SelectPanelOverlayManager(this._injector, this._document, this.element);
		// A host binding only runs while the PARENT view refreshes, and open() ends in a local
		// detectChanges(), so the class never appeared without a global tick (zoneless/OnPush).
		this._reflectOpenState = (open: boolean) => {
			if (open) {
				_renderer.addClass(this.element, 'ng-select-opened');
				_renderer.addClass(this.element, 'hub-select__control--opened');
			} else {
				_renderer.removeClass(this.element, 'ng-select-opened');
				_renderer.removeClass(this.element, 'hub-select__control--opened');
			}
		};
		effect(() => this._reflectOpenState(this.isOpen() ?? false));
		this._handleSignalChanges();
		afterEveryRender({
			read: () => {
				const consumerClasses = readConsumerHostClasses(this.element);
				const normalized = consumerClasses || null;
				if (normalized !== this._consumerHostClasses()) {
					this._consumerHostClasses.set(normalized);
				}
			}
		});
		this._destroyRef.onDestroy(() => {
			this._dropdownOverlay.destroy();
			this.dropdownOverlayRef = null;
		});
	}

	private _focused = false;

	/**
	 * Gets whether the component currently owns focus.
	 *
	 * @returns The focused.
	 *
	 * @since 20.4.2
	 */
	get focused() {
		return this._focused;
	}

	/**
	 * Gets whether search filtering or text composition is active.
	 *
	 * @returns The filtered.
	 *
	 * @since 3.0.0
	 */
	get filtered() {
		return (!!this.searchTerm && this.searchable()) || this._isComposing;
	}

	/**
	 * Gets the search term.
	 *
	 * @returns The search term.
	 *
	 * @since 20.4.2
	 */
	get searchTerm() {
		return this._searchTerm();
	}

	/**
	 * Gets the selected items.
	 *
	 * @returns The selected items.
	 *
	 * @since 3.0.0
	 */
	get selectedItems(): SelectEngineOption[] {
		return this.itemsList.selectedItems;
	}

	/**
	 * Gets the selected values.
	 *
	 * @returns The selected values.
	 *
	 * @since 3.0.0
	 */
	get selectedValues() {
		return this.selectedItems.map((x) => x.value);
	}

	/**
	 * Determines whether the component has selected values.
	 *
	 * @returns Whether has value.
	 *
	 * @since 3.0.0
	 */
	get hasValue() {
		return this.selectedItems.length > 0;
	}

	/**
	 * Gets the current panel position.
	 *
	 * @returns The current panel position.
	 *
	 * @since 3.0.0
	 */
	get currentPanelPosition(): DropdownPosition | undefined {
		if (this.dropdownPanel()) {
			return this.dropdownPanel().currentPosition;
		}
		return undefined;
	}

	/**
	 * Determines whether the add-tag option should be displayed.
	 *
	 * @returns Whether show add tag.
	 *
	 * @since 3.0.0
	 */
	get showAddTag() {
		if (!this._validTerm()) {
			return false;
		}

		const term = (this.searchTerm ?? '').toLowerCase().trim();
		return (
			this.addTag() &&
			!this.itemsList.filteredItems.some((x) => x.label?.toLowerCase() === term) &&
			((!this.hideSelected() && this.isOpen()) || !this.selectedItems.some((x) => x.label?.toLowerCase() === term)) &&
			!this.loading()
		);
	}

	clearItem = (item: any) => {
		const option = this.selectedItems.find((x) => x.value === item);
		if (option) {
			this.unselect(option);
		}
	};

	/**
	 * Initializes the instance after Angular has assigned its inputs.
	 *
	 * @since 3.0.0
	 */
	ngOnInit() {
		this._handleKeyPresses();
		this._setInputAttributes();
	}

	/**
	 * Responds to Angular input changes.
	 *
	 * @param changes - The changed Angular inputs.
	 *
	 * @since 3.0.0
	 */
	ngOnChanges(changes: SimpleChanges) {
		const itemsChange = changes['items'];
		const isOpenChange = changes['isOpen'];
		const groupByChange = changes['_groupBy'] ?? changes['groupBy'];

		if (itemsChange?.firstChange) {
			this._itemsAreUsed = true;
			this._setItems(itemsChange.currentValue || []);
		}

		if (isOpenChange) {
			this._manualOpen = isDefined(isOpenChange.currentValue);
		}

		if (groupByChange?.firstChange && !itemsChange) {
			this._setItems([...this.items()]);
		}
	}

	/**
	 * Completes initialization that depends on rendered view children.
	 *
	 * @since 3.0.0
	 */
	ngAfterViewInit() {
		if (!this._itemsAreUsed) {
			this._setItemsFromNgOptions();
		}

		if (isDefined(this.autoFocus)) {
			this.focus();
		}
	}

	/**
	 * Routes a keyboard event to the appropriate ng-select interaction handler.
	 *
	 * @param $event - The DOM event to process.
	 *
	 * @since 3.0.0
	 */
	@HostListener('keydown', ['$event'])
	handleKeyDown($event: KeyboardEvent) {
		const keyName = $event.key;
		if (Object.values(KeyCode).includes(keyName as KeyCode)) {
			this.handleKeyCode($event);
		} else if (keyName && keyName.length === 1) {
			this._keyPress$.next(keyName.toLocaleLowerCase());
		}
	}

	/**
	 * Handles navigation and selection key codes.
	 *
	 * @param $event - The DOM event to process.
	 *
	 * @since 3.1.1
	 */
	handleKeyCode($event: KeyboardEvent) {
		const target = $event.target;

		const clearButton = this.clearButton();
		if (clearButton && clearButton.nativeElement === target) {
			this.handleKeyCodeClear($event);
		} else {
			this.handleKeyCodeInput($event);
		}
	}

	/**
	 * Handles keyboard interaction originating from the search input.
	 *
	 * @param $event - The DOM event to process.
	 *
	 * @since 11.1.2
	 */
	handleKeyCodeInput($event: KeyboardEvent) {
		switch ($event.key) {
			case KeyCode.ArrowDown:
				this._handleArrowDown($event);
				break;
			case KeyCode.ArrowUp:
				this._handleArrowUp($event);
				break;
			case KeyCode.Space:
				this._handleSpace($event);
				break;
			case KeyCode.Enter:
				this._handleEnter($event);
				break;
			case KeyCode.Tab:
				this._handleTab($event);
				break;
			case KeyCode.Esc:
				// Only consume Escape when it closes the dropdown so parent overlays/dialogs can still handle Escape when already closed
				if (!this.isOpen() || this._manualOpen) {
					return;
				}
				this.close();
				$event.preventDefault();
				break;
			case KeyCode.Backspace:
				this._handleBackspace();
				break;
		}
	}

	/**
	 * Handles keyboard interaction on the clear control.
	 *
	 * @param $event - The DOM event to process.
	 *
	 * @since 11.1.2
	 */
	handleKeyCodeClear($event: KeyboardEvent) {
		switch ($event.key) {
			case KeyCode.Enter:
			case KeyCode.Space:
				this.handleClearClick();
				$event.preventDefault();
				break;
		}
	}

	/**
	 * Handles keyboard removal of a selected value.
	 *
	 * @param $event - The DOM event to process.
	 * @param item - The option to process.
	 *
	 * @since 23.3.0
	 */
	handleRemoveKeydown($event: KeyboardEvent, item: SelectEngineOption) {
		if (item.disabled) {
			return;
		}
		if ($event.key === KeyCode.Enter || $event.key === KeyCode.Space) {
			$event.preventDefault();
			$event.stopPropagation();
			this.unselect(item);
		}
	}

	/**
	 * Handles pointer interaction within the select container.
	 *
	 * @param $event - The DOM event to process.
	 *
	 * @since 3.0.0
	 */
	handleMousedown($event: MouseEvent): void {
		if (this.disabled()) {
			return;
		}

		const target = $event.target as HTMLElement;

		// Allow highlighting/copying the selected label when search is disabled.
		// Skipping preventDefault + toggle lets the browser start a text selection.
		// See https://github.com/ng-select/ng-select/issues/2669
		const onSelectedValue = !!target.closest?.('.hub-select__value');
		const onValueIcon =
			target.classList.contains('hub-select__value-remove') || !!target.closest?.('.hub-select__value-remove');
		if (!this.searchable() && onSelectedValue && !onValueIcon) {
			if (!this._focused) {
				this.focus();
			}
			return;
		}

		// Skip during Angular event replay (SSR hydration): preventDefault has no effect
		// after browser dispatch and throws — see https://github.com/ng-select/ng-select/issues/2549
		if (target.tagName !== 'INPUT' && $event.eventPhase !== EventPhase.REPLAY) {
			$event.preventDefault();
		}

		if (target.classList.contains('hub-select__clear')) {
			// Don't handle clear on mousedown - let click event handle it
			return;
		}

		if (target.classList.contains('hub-select__arrow-wrapper')) {
			this.handleArrowClick();
			return;
		}

		if (target.classList.contains('hub-select__value-remove')) {
			return;
		}

		if (!this._focused) {
			this.focus();
		}

		if (this.searchable()) {
			this.open();
		} else {
			this.toggle();
		}
	}

	/**
	 * Toggles the dropdown from the arrow control.
	 *
	 * @since 3.0.0
	 */
	handleArrowClick() {
		if (this.isOpen()) {
			this.close();
		} else {
			this.open();
		}
	}

	/**
	 * Clears the model from a pointer interaction.
	 *
	 * @param _event - The DOM event to process.
	 *
	 * @since 3.0.0
	 */
	handleClearClick(_event?: MouseEvent) {
		if (this.hasValue) {
			this.itemsList.clearSelected(true);
			this._updateNgModel();
		}
		this._clearSearch();
		this.focus();
		this.clearEvent.emit();

		this._onSelectionChanged();
	}

	/**
	 * Clears the selected model values and resets the search state.
	 *
	 * @since 3.0.0
	 */
	clearModel() {
		if (!this.clearable()) {
			return;
		}
		this.itemsList.clearSelected(false);
		this._updateNgModel();
	}

	/**
	 * Writes a ControlValueAccessor model value into the component.
	 *
	 * @param value - The value to process.
	 *
	 * @since 3.0.0
	 */
	writeValue(value: any | any[]): void {
		this._lastWrittenValue = value;
		this.itemsList.clearSelected(false);
		this._handleWriteValue(value);
		this._cd.markForCheck();
	}

	/**
	 * Registers the ControlValueAccessor model-change callback.
	 *
	 * @param fn - The fn.
	 *
	 * @since 3.0.0
	 */
	registerOnChange(fn: any): void {
		this._onChange = fn;
	}

	/**
	 * Registers the ControlValueAccessor touched callback.
	 *
	 * @param fn - The fn.
	 *
	 * @since 3.0.0
	 */
	registerOnTouched(fn: any): void {
		this._onTouched = fn;
	}

	/**
	 * Updates the disabled state supplied by Angular forms.
	 *
	 * @param state - The state.
	 *
	 * @since 3.0.0
	 */
	setDisabledState(state: boolean): void {
		this._disabled.set(state);
		this._cd.markForCheck();
	}

	/**
	 * Toggles the dropdown panel.
	 *
	 * @since 3.0.0
	 */
	toggle() {
		if (!this.isOpen()) {
			this.open();
		} else {
			this.close();
		}
	}

	/**
	 * Opens the select dropdown panel
	 *
	 * @since 3.0.0
	 */
	open() {
		if (this.disabled() || this.isOpen() || this._manualOpen) {
			return;
		}

		if (!this.typeahead()?.observed && !this.addTag() && this.itemsList.noItemsToSelect) {
			return;
		}
		this.isOpen.set(true);
		this._reflectOpenState(true);
		this.itemsList.markSelectedOrDefault(true);
		this.openEvent.emit();
		if (!this.searchTerm) {
			this.focus();
		}
		// Attach synchronously (effects only flush on the next tick): consumers expect the
		// panel to be in the DOM right after open() returns
		this._syncDropdownOverlay();
		this.detectChanges();
	}

	/**
	 * Closes the select dropdown panel
	 *
	 * @since 3.0.0
	 */
	close() {
		if (!this.isOpen() || this._manualOpen) {
			return;
		}
		this.isOpen.set(false);
		this._reflectOpenState(false);
		this._isComposing = false;
		this._clearSearch();
		this.itemsList.unmarkItem();
		this._onTouched();
		this.closeEvent.emit();
		// Detach synchronously (effects only flush on the next tick): the panel must leave
		// the DOM without relying on zone-triggered change detection (#2765)
		this._syncDropdownOverlay();
		this.detectChanges();
	}

	/**
	 * Selects or unselects an option based on its current state.
	 *
	 * @param item - The option to process.
	 *
	 * @since 3.0.0
	 */
	toggleItem(item: SelectEngineOption) {
		if (!item || item.disabled || this.disabled()) {
			return;
		}

		if (this.deselectOnClickValue() && item.selected) {
			this.unselect(item);
		} else {
			this.select(item);
		}
	}

	/**
	 * Selects an option according to the active selection mode.
	 *
	 * @param item - The option to process.
	 *
	 * @since 3.0.0
	 */
	select(item: SelectEngineOption) {
		if (!item.selected) {
			this.itemsList.select(item);
			if (this.clearSearchOnAddValue()) {
				this._clearSearch();
			}

			this._updateNgModel();
			if (this.multiple()) {
				this.addEvent.emit(item.value);
			}
		}

		if (this.closeOnSelect() || this.itemsList.noItemsToSelect) {
			this.close();
		}

		this._onSelectionChanged();
	}

	/**
	 * Focuses the select element
	 *
	 * @since 3.0.0
	 */
	focus() {
		this.searchInput()?.nativeElement.focus();
	}

	/**
	 * Blurs the select element
	 *
	 * @since 3.0.0
	 */
	blur() {
		this.searchInput()?.nativeElement.blur();
	}

	/**
	 * Removes an option from the current selection.
	 *
	 * @param item - The option to process.
	 *
	 * @since 3.0.0
	 */
	unselect(item: SelectEngineOption) {
		if (!item || this.disabled() || item.disabled) {
			return;
		}

		this.itemsList.unselect(item);
		this.focus();
		this._updateNgModel();
		this.removeEvent.emit(item.value);
		this._onSelectionChanged();
	}

	/**
	 * Creates and selects an option from the current search term.
	 *
	 * @since 3.0.0
	 */
	selectTag() {
		let tag;
		if (isFunction(this.addTag())) {
			tag = (<AddTagFn>this.addTag())(this.searchTerm!);
		} else {
			tag = this._primitive ? this.searchTerm : { [String(this.bindLabel())]: this.searchTerm };
		}

		// Read once, up front: the panel may close before the promise resolves, and whether the
		// created item joins the list is decided by the state the user acted in.
		const wasOpen = this.isOpen();
		const handleTag = (item: any) =>
			this.typeahead()?.observed || !wasOpen ? this.itemsList.mapItem(item, null) : this.itemsList.addItem(item);
		if (isPromise(tag)) {
			// Close now, as the synchronous branch does: an `addTag` that opens a dialog must not
			// leave the panel hanging over it until the promise resolves.
			if (this.closeOnSelect()) {
				this.close();
			}

			// Same guard as the synchronous branch: resolving with nothing means "nothing to add".
			tag.then((item) => {
				if (item) {
					this.select(handleTag(item));
				}
			}).catch(() => {});
		} else if (tag) {
			this.select(handleTag(tag));
		}
	}

	/**
	 * Determines whether the clear control should be displayed.
	 *
	 * @since 3.0.0
	 */
	showClear() {
		return this.clearable() && (this.hasValue || this.searchTerm) && !this.disabled();
	}

	/**
	 * Moves keyboard focus to the clear control.
	 *
	 * @since 11.1.2
	 */
	focusOnClear() {
		this.blur();
		if (this.clearButton()) {
			this.clearButton()?.nativeElement.focus();
		}
	}

	trackByOption = (index: number, _item: SelectEngineOption) => {
		// Track by position: options are re-created on every items change, so identity tracking
		// would replace the option DOM between mousedown and click (#2551).
		return index;
	};

	/**
	 * Determines whether the empty-results message should be displayed.
	 *
	 * @since 3.0.0
	 */
	showNoItemsFound() {
		const empty = this.itemsList.filteredItems.length === 0;
		return (
			((empty && !this.typeahead()?.observed && !this.loading()) ||
				(empty && this.typeahead()?.observed && this._validTerm() && !this.loading())) &&
			!this.showAddTag
		);
	}

	/**
	 * Determines whether the type-to-search prompt should be displayed.
	 *
	 * @since 3.0.0
	 */
	showTypeToSearch() {
		const empty = this.itemsList.filteredItems.length === 0;
		return empty && this.typeahead()?.observed && !this._validTerm() && !this.loading();
	}

	/**
	 * Marks the start of an input method editor composition.
	 *
	 * @since 3.0.5
	 */
	onCompositionStart() {
		this._isComposing = true;
	}

	/**
	 * Finishes input method editor composition and applies the search term.
	 *
	 * @since 3.0.5
	 */
	onCompositionEnd() {
		this._isComposing = false;
	}

	/**
	 * Filters the available options using the current search configuration.
	 *
	 * @param term - The term.
	 *
	 * @since 3.0.0
	 */
	filter(term: string) {
		this._searchTerm.set(term);
		if (this.typeahead()?.observed && (this._validTerm() || this.minTermLength() === 0)) {
			this.typeahead()?.next(term);
		}

		if (!this.typeahead()?.observed) {
			this.itemsList.filter(term);
			if (this.isOpen()) {
				this.itemsList.markSelectedOrDefault(true);
			}
		}

		this.searchEvent.emit({ term, items: this.itemsList.filteredItems.map((x) => x.value) });
		this.open();
	}

	/**
	 * Handles focus entering the search input.
	 *
	 * @param $event - The DOM event to process.
	 *
	 * @since 3.0.0
	 */
	onInputFocus($event: FocusEvent) {
		if (this._focused) {
			return;
		}

		this.element.classList.add('ng-select-focused', 'hub-select__control--focused');
		this.focusEvent.emit($event);
		this._focused = true;
	}

	/**
	 * Handles focus leaving the search input.
	 *
	 * @param $event - The DOM event to process.
	 *
	 * @since 3.0.0
	 */
	onInputBlur($event: FocusEvent) {
		this.element.classList.remove('ng-select-focused', 'hub-select__control--focused');
		this.blurEvent.emit($event);
		if (!this.isOpen() && !this.disabled()) {
			this._onTouched();
		}
		this._focused = false;
	}

	/**
	 * Marks an option when pointer interaction hovers it.
	 *
	 * @param item - The option to process.
	 *
	 * @since 3.0.0
	 */
	onItemHover(item: SelectEngineOption) {
		if (item.disabled) {
			return;
		}
		this.itemsList.markItem(item);
	}

	/**
	 * Requests an OnPush change-detection pass.
	 *
	 * @since 3.0.0
	 */
	detectChanges() {
		if (!(<any>this._cd).destroyed) {
			this._cd.detectChanges();
		}
	}

	private _onChange = (_: any) => {};

	private _onTouched = () => {};

	/**
	 * Registers effects that synchronize signal-based inputs with component state.
	 *
	 * @since 23.0.4
	 */
	private _handleSignalChanges() {
		let itemsInitialized = false;
		effect(
			() => {
				const items = this.items();

				if (!itemsInitialized) {
					itemsInitialized = true;
					return;
				}

				untracked(() => {
					this._itemsAreUsed = true;
					this._setItems(items || []);
				});
			},
			{ injector: this._injector }
		);

		let multipleInitialized = false;
		effect(
			() => {
				this.multiple();

				if (!multipleInitialized) {
					multipleInitialized = true;
					return;
				}

				untracked(() => {
					const written = this._lastWrittenValue;
					this._resyncSelectionFromWrittenValue();
					const hadValue = isDefined(written) && !(Array.isArray(written) && written.length === 0);
					if (hadValue && !this.hasValue) {
						// The retained value cannot be represented in the new mode; emit the cleared value
						// so the form model and the UI stay in sync
						this._updateNgModel();
					}
				});
			},
			{ injector: this._injector }
		);

		// Re-map the retained form value when the value binding or comparator changes.
		// bindLabel is intentionally not tracked: _setItems writes it and would loop.
		let bindingsInitialized = false;
		effect(
			() => {
				this.bindValue();
				this.compareWith();

				if (!bindingsInitialized) {
					bindingsInitialized = true;
					return;
				}

				untracked(() => this._resyncSelectionFromWrittenValue());
			},
			{ injector: this._injector }
		);

		let groupByInitialized = false;
		effect(
			() => {
				this.groupBy();

				if (!groupByInitialized) {
					groupByInitialized = true;
					return;
				}

				untracked(() => this._setItems([...this.items()]));
			},
			{ injector: this._injector }
		);

		effect(
			() => {
				this.inputAttrs();
				const input = this.searchInput();

				if (!input) {
					return;
				}

				untracked(() => this._setInputAttributes());
			},
			{ injector: this._injector }
		);

		// open()/close() sync the overlay imperatively; this effect covers the paths that
		// bypass them — an [isOpen] binding (manual mode), programmatic isOpen.set(), and
		effect(
			() => {
				this.isOpen();
				// Track the template query too: with [isOpen] pre-set, the first run can happen
				// before view children resolve, and this re-runs the effect once they do
				this._dropdownTemplate();

				untracked(() => this._syncDropdownOverlay());
			},
			{ injector: this._injector }
		);
	}

	/**
	 * Re-applies the last written form value against the current mode and bindings.
	 *
	 * @since 24.0.5
	 */
	private _resyncSelectionFromWrittenValue() {
		this.itemsList.clearSelected(false);
		this._handleWriteValue(this._lastWrittenValue);
		this._cd.markForCheck();
	}

	/**
	 * Maps the bound items collection into the internal option list.
	 *
	 * @param items - The options to process.
	 *
	 * @since 3.0.0
	 */
	private _setItems(items: readonly any[]) {
		const firstItem = items[0];
		this.bindLabel.set(this.bindLabel() || this._defaultLabel);
		this._primitive = isDefined(firstItem)
			? !isObject(firstItem)
			: this._primitive || this.bindLabel() === this._defaultLabel;
		this.itemsList.setItems(items);
		if (items.length > 0 && this.hasValue) {
			this.itemsList.mapSelectedItems();
		}
		if (this.isOpen() && isDefined(this.searchTerm) && !this.typeahead()?.observed) {
			this.itemsList.filter(this.searchTerm);
		}
		if (this.typeahead()?.observed || this.isOpen()) {
			this.itemsList.markSelectedOrDefault(true);
		}
	}

	/**
	 * Maps projected `ng-option` components into the internal option list.
	 *
	 * @since 3.0.0
	 */
	private _setItemsFromNgOptions() {
		effect(
			() => {
				const options = this.ngOptions();
				// Wait until all ng-option inputs are initialized (avoids _groupBy crash when values load async)
				if (options.length > 0 && !options.every((opt) => opt.isInitialized())) {
					return;
				}

				this.bindLabel.set(this._defaultLabel);
				const items = options.map((option) => ({
					$ngOptionValue: option.value(),
					$ngOptionLabel: option.label(),
					$ngOptionClasses: option.classes(),
					disabled: option.disabled()
				}));
				this.items.set(items);
				this.itemsList.setItems(items);
				if (this.hasValue) {
					this.itemsList.mapSelectedItems();
				}
				this._cd.detectChanges();

				options
					// find item for each option
					.map((option) => ({
						option,
						item: this.itemsList.findItem(option.value())
					}))
					// filter non found items
					.filter((entry): entry is typeof entry & { item: SelectEngineOption } => isDefined(entry.item))
					// process to update disabled and label
					.forEach(({ option, item }) => {
						item.disabled = option.disabled();
						item.label = option.label() || item.label;
						item.classes = option.classes();
					});
			},
			{ injector: this._injector }
		);
	}

	/**
	 * Maps a valid external model value into selected options.
	 *
	 * @param value - The form value.
	 *
	 * @since 3.0.0
	 */
	private _handleWriteValue(value: any | any[]) {
		const validation = validateWriteValue(value, {
			bindValue: this.bindValue(),
			compareWith: this.compareWith(),
			multiple: this.multiple()
		});
		if (!validation.valid) {
			if (validation.warning) {
				this._console.warn(validation.warning);
			}
			return;
		}

		const select = (val: any) => {
			let item = this.itemsList.findItem(val);
			if (item) {
				this.itemsList.select(item);
			} else {
				item = createUnmatchedOptionValue(val, this.bindLabel() || this._defaultLabel, this.bindValue());
				this.itemsList.select(this.itemsList.mapItem(item, null));
			}
		};

		if (this.multiple()) {
			(<any[]>value).forEach((item) => select(item));
		} else {
			select(value);
		}
	}

	/**
	 * Matches typed characters to options for keyboard navigation.
	 *
	 * @since 3.0.0
	 */
	private _handleKeyPresses() {
		if (this.searchable()) {
			return;
		}

		this._keyPress$
			.pipe(
				takeUntilDestroyed(this._destroyRef),
				tap((letter) => this._pressedKeys.push(letter)),
				debounceTime(200),
				filter(() => this._pressedKeys.length > 0),
				map(() => this._pressedKeys.join(''))
			)
			.subscribe((term) => {
				const item = this.itemsList.findByLabel(term);
				if (item) {
					if (this.isOpen()) {
						if (!item.disabled) {
							this.itemsList.markItem(item);
							this._scrollToMarked();
							// Required under zoneless CD: this subscription fires from a debounce
							// timer, which schedules nothing by itself
							this._cd.markForCheck();
						}
					} else {
						this.select(item);
					}
				}
				this._pressedKeys = [];
			});
	}

	/**
	 * Applies configured attributes to the native search input.
	 *
	 * @since 3.0.0
	 */
	private _setInputAttributes() {
		const input = this.searchInput()?.nativeElement;
		if (!input) {
			return;
		}
		const attributes: Record<string, string> = {
			type: 'text',
			autocorrect: 'off',
			autocapitalize: 'off',
			autocomplete: 'off',
			...this.inputAttrs()
		};

		for (const key of Object.keys(attributes)) {
			input.setAttribute(key, attributes[key]);
		}
	}

	/**
	 * Builds and emits the current ControlValueAccessor model value.
	 *
	 * @since 3.0.0
	 */
	private _updateNgModel() {
		const model = selectedItemsToModel(
			this.selectedItems,
			{
				bindValue: this.bindValue(),
				groupBy: this.groupBy(),
				hasGroupValue: !!this.groupValue()
			},
			(value, key) => this.itemsList.resolveNested(value, key)
		);

		const selected = this.selectedItems.map((x) => x.value);
		if (this.multiple()) {
			this._lastWrittenValue = model;
			this._onChange(model);
			this.changeEvent.emit(selected);
		} else {
			const single = isDefined(model[0]) ? model[0] : null;
			this._lastWrittenValue = single;
			this._onChange(single);
			this.changeEvent.emit(selected[0]);
		}

		// Required under zoneless CD: sole notifier for the programmatic selection
		// APIs (select/unselect/clearModel/clearItem) called from non-Angular contexts
		this._cd.markForCheck();
	}

	/**
	 * Clears the current search term when configuration permits it.
	 *
	 * @since 3.0.0
	 */
	private _clearSearch() {
		if (!this.searchTerm) {
			return;
		}

		this._changeSearch(null);
		this.itemsList.resetFilteredItems();
	}

	/**
	 * Updates the search term and emits the search event.
	 *
	 * @param searchTerm - The search term.
	 *
	 * @since 3.0.6
	 */
	private _changeSearch(searchTerm: string | null) {
		this._searchTerm.set(searchTerm);
	}

	/**
	 * Scrolls the dropdown to the currently marked option.
	 *
	 * @since 3.0.0
	 */
	private _scrollToMarked() {
		if (!this.isOpen() || !this.dropdownPanel()) {
			return;
		}
		this.dropdownPanel().scrollTo(this.itemsList.markedItem);
	}

	/**
	 * Scrolls the dropdown to the add-tag option.
	 *
	 * @since 3.0.0
	 */
	private _scrollToTag() {
		if (!this.isOpen() || !this.dropdownPanel()) {
			return;
		}
		this.dropdownPanel().scrollToTag();
	}

	/**
	 * Synchronizes search and close behavior after selection changes.
	 *
	 * @since 3.0.0
	 */
	private _onSelectionChanged() {
		if (this.isOpen() && this.deselectOnClickValue()) {
			// Make sure items are rendered.
			this._cd.detectChanges();
			this.dropdownPanel()?.adjustPosition();
		}
	}

	/**
	 * Attaches or detaches the dropdown overlay to match the current open state. Idempotent.
	 *
	 * @since 23.7.0
	 */
	private _syncDropdownOverlay() {
		const template = this._dropdownTemplate();
		const viewContainer = this._dropdownOutlet();
		if (!template || !viewContainer) {
			return;
		}
		if (this.isOpen()) {
			const origin = this._dropdownOrigin();
			this._dropdownOverlay.open({
				appendTo: this.appendTo() ?? this.config.appendTo ?? null,
				beforeAttach: (overlayRef) => {
					this.dropdownOverlayRef = overlayRef;
					this.dropdownOrigin = origin;
				},
				origin,
				position: 'auto',
				template,
				viewContainer
			});
		} else {
			this._dropdownOverlay.close();
		}
	}

	/**
	 * The dropdown anchors to the `.hub-select__box` box, not the host: themes may pad
	 * the host below the container (material reserves 1.25em of subscript space under the
	 * underline), and the panel must sit flush against the visible field — the same anchor
	 * the pre-overlay `appendTo` positioning used.
	 *
	 * @since 23.7.0
	 */
	private _dropdownOrigin(): HTMLElement {
		return this.dropdownAnchor()?.() ?? this._selectContainer()?.nativeElement ?? this.element;
	}

	/**
	 * Handles Tab selection, clear-control focus, and close behavior.
	 *
	 * @param $event - The DOM event to process.
	 *
	 * @since 3.0.0
	 */
	private _handleTab($event: KeyboardEvent) {
		if (this.isOpen() === false) {
			if (this.showClear() && !$event.shiftKey && this.config.tabFocusOnClear) {
				this.focusOnClear();
				$event.preventDefault();
			} else if (!this.addTag()) {
				return;
			}
		}

		this.close();
	}

	/**
	 * Handles Enter selection and dropdown opening.
	 *
	 * @param $event - The DOM event to process.
	 *
	 * @since 3.0.0
	 */
	private _handleEnter($event: KeyboardEvent) {
		if (this.isOpen() || this._manualOpen) {
			if (this.itemsList.markedItem) {
				this.toggleItem(this.itemsList.markedItem);
			} else if (this.showAddTag) {
				this.selectTag();
			}
		} else if (this.config.openOnEnter) {
			this.open();
		} else {
			return;
		}

		$event.preventDefault();
	}

	/**
	 * Handles Space selection and dropdown opening.
	 *
	 * @param $event - The DOM event to process.
	 *
	 * @since 3.0.0
	 */
	private _handleSpace($event: KeyboardEvent) {
		if (this.isOpen() || this._manualOpen) {
			return;
		}
		this.open();
		$event.preventDefault();
	}

	/**
	 * Moves the marked option down or opens the dropdown.
	 *
	 * @param $event - The DOM event to process.
	 *
	 * @since 3.0.0
	 */
	private _handleArrowDown($event: KeyboardEvent) {
		if (this._nextItemIsTag(+1)) {
			this.itemsList.unmarkItem();
			this._scrollToTag();
		} else {
			this.itemsList.markNextItem();
			this._scrollToMarked();
		}
		this.open();
		$event.preventDefault();
	}

	/**
	 * Moves the marked option up or opens the dropdown.
	 *
	 * @param $event - The DOM event to process.
	 *
	 * @since 3.0.0
	 */
	private _handleArrowUp($event: KeyboardEvent) {
		if (!this.isOpen()) {
			return;
		}

		if (this._nextItemIsTag(-1)) {
			this.itemsList.unmarkItem();
			this._scrollToTag();
		} else {
			this.itemsList.markPreviousItem();
			this._scrollToMarked();
		}
		$event.preventDefault();
	}

	/**
	 * Determines whether the next keyboard target is the add-tag option.
	 *
	 * @param nextStep - The next step.
	 * @returns Whether next item is tag.
	 *
	 * @since 3.0.0
	 */
	private _nextItemIsTag(nextStep: number): boolean {
		const nextIndex = this.itemsList.markedIndex + nextStep;
		return !!(
			this.addTag() &&
			this.searchTerm &&
			this.itemsList.markedItem &&
			(nextIndex < 0 || nextIndex === this.itemsList.filteredItems.length)
		);
	}

	/**
	 * Removes the last selected value when Backspace clearing is enabled.
	 *
	 * @since 3.0.0
	 */
	private _handleBackspace() {
		if (this.searchTerm || !this.clearable() || !this.hasValue) {
			return;
		}

		if (this.multiple()) {
			const last = this.itemsList.lastSelectedItem;
			if (last) {
				this.unselect(last);
			}
		} else {
			this.clearModel();
		}
	}

	/**
	 * Applies configured global defaults that were not set locally.
	 *
	 * @param config - The global ng-select configuration.
	 *
	 * @since 3.0.0
	 */
	private _mergeGlobalConfig(config: HubSelectConfig) {
		this.bindValue.set(this.bindValue() || config.bindValue);
		this.bindLabel.set(this.bindLabel() || config.bindLabel || this._defaultLabel);
	}

	/**
	 * Gets disableVirtualScroll value from input or from config
	 *
	 *  @param config HubSelectConfig object
	 *
	 *  @returns `true` if disableVirtualScroll is enabled, `false` otherwise
	 *
	 * @since 14.7.0
	 */
	private isVirtualScrollDisabled(config: HubSelectConfig) {
		return isDefined(config.disableVirtualScroll) ? !config.disableVirtualScroll : false;
	}
}
