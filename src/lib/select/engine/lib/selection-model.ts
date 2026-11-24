import { SelectEngineOption } from './types/select-engine.types';

export type SelectionModelFactory = () => SelectionModel;

/**
 * Creates the default selection model used by ng-select.
 *
 * @since 3.0.0
 */
export function DefaultSelectionModelFactory() {
	return new DefaultSelectionModel();
}

/**
 * Defines the selection model contract used by ng-select.
 *
 * @since 3.0.0
 */
export interface SelectionModel {
	value: SelectEngineOption[];
	/**
	 * Selects an option according to the active selection mode.
	 *
	 * @param item - The option to process.
	 * @param multiple - Whether multiple selection is enabled.
	 * @param selectableGroupAsModel - Whether a selectable group is represented by its group value.
	 *
	 * @since 3.0.0
	 */
	select(item: SelectEngineOption, multiple: boolean, selectableGroupAsModel: boolean): void;
	/**
	 * Removes an option from the current selection.
	 *
	 * @param item - The option to process.
	 * @param multiple - Whether multiple selection is enabled.
	 *
	 * @since 3.0.0
	 */
	unselect(item: SelectEngineOption, multiple: boolean): void;
	/**
	 * Clears the current selection.
	 *
	 * @param keepDisabled - Whether disabled options should remain selected.
	 *
	 * @since 3.0.0
	 */
	clear(keepDisabled: boolean): void;
}

/**
 * Implements the default single, multiple, and grouped option selection behavior.
 *
 * @since 3.0.0
 */
export class DefaultSelectionModel implements SelectionModel {
	private _selected: SelectEngineOption[] = [];

	/**
	 * Gets the currently selected options.
	 *
	 * @returns The value.
	 *
	 * @since 3.0.0
	 */
	get value(): SelectEngineOption[] {
		return this._selected;
	}

	/**
	 * Selects an option according to the active selection mode.
	 *
	 * @param item - The option to process.
	 * @param multiple - Whether multiple selection is enabled.
	 * @param groupAsModel - Whether a selectable group is represented by its group value.
	 *
	 * @since 3.0.0
	 */
	select(item: SelectEngineOption, multiple: boolean, groupAsModel: boolean) {
		item.selected = true;
		if (!item.children || (!multiple && groupAsModel)) {
			this._selected.push(item);
		}
		if (multiple) {
			if (item.parent) {
				// A parent option is a group header built by ItemsList, which always gives it children.
				const siblings = item.parent.children!;
				const childrenCount = siblings.length;
				const selectedCount = siblings.filter((x) => x.selected).length;
				item.parent.selected = childrenCount === selectedCount;
			} else if (item.children) {
				this._setChildrenSelectedState(item.children, true);
				this._removeChildren(item);
				if (groupAsModel && this._activeChildren(item)) {
					this._selected = [...this._selected.filter((x) => x.parent !== item), item];
				} else {
					this._selected = [...this._selected, ...item.children.filter((x) => !x.disabled)];
				}
			}
		}
	}

	/**
	 * Removes an option from the current selection.
	 *
	 * @param item - The option to process.
	 * @param multiple - Whether multiple selection is enabled.
	 *
	 * @since 3.0.0
	 */
	unselect(item: SelectEngineOption, multiple: boolean) {
		this._selected = this._selected.filter((x) => x !== item);
		item.selected = false;
		if (multiple) {
			if (item.parent && item.parent.selected) {
				const children = item.parent.children!;
				this._removeParent(item.parent);
				this._removeChildren(item.parent);
				this._selected.push(...children.filter((x) => x !== item && !x.disabled));
				item.parent.selected = false;
			} else if (item.children) {
				this._setChildrenSelectedState(item.children, false);
				this._removeChildren(item);
			}
		}
	}

	/**
	 * Clears the current selection.
	 *
	 * @param keepDisabled - Whether disabled options should remain selected.
	 *
	 * @since 3.0.0
	 */
	clear(keepDisabled: boolean) {
		this._selected = keepDisabled ? this._selected.filter((x) => x.disabled) : [];
	}

	/**
	 * Applies a selected state to every enabled child option.
	 *
	 * @param children - The children.
	 * @param selected - Whether the children should be selected.
	 *
	 * @since 3.0.0
	 */
	private _setChildrenSelectedState(children: SelectEngineOption[], selected: boolean) {
		for (const child of children) {
			if (child.disabled) {
				continue;
			}
			child.selected = selected;
		}
	}

	/**
	 * Removes a group’s child options from the selected collection.
	 *
	 * @param parent - The parent.
	 *
	 * @since 3.0.0
	 */
	private _removeChildren(parent: SelectEngineOption) {
		this._selected = [
			...this._selected.filter((x) => x.parent !== parent),
			...parent.children!.filter((x) => x.parent === parent && x.disabled && x.selected)
		];
	}

	/**
	 * Removes a group option from the selected collection.
	 *
	 * @param parent - The parent.
	 *
	 * @since 3.0.0
	 */
	private _removeParent(parent: SelectEngineOption) {
		this._selected = this._selected.filter((x) => x !== parent);
	}

	/**
	 * Determines whether a group contains active child options.
	 *
	 * @param item - The option to process.
	 * @returns Whether active children.
	 *
	 * @since 3.7.0
	 */
	private _activeChildren(item: SelectEngineOption): boolean {
		return item.children!.every((x) => !x.disabled || x.selected);
	}
}
