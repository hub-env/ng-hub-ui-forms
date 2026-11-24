/**
 * Defines the ng option contract used by ng-select.
 *
 * @since 3.0.0
 */
export interface SelectEngineOption {
	[name: string]: any;

	index?: number | null;
	htmlId?: string;
	selected?: boolean;
	disabled?: boolean;
	marked?: boolean;
	label?: string;
	value?: string | any;
	classes?: string;
	parent?: SelectEngineOption | null;
	children?: SelectEngineOption[];
}

export enum KeyCode {
	Tab = 'Tab',
	Enter = 'Enter',
	Esc = 'Escape',
	Space = ' ',
	ArrowUp = 'ArrowUp',
	ArrowDown = 'ArrowDown',
	Backspace = 'Backspace'
}

export type DropdownPosition = 'top' | 'right' | 'bottom' | 'left' | 'auto';
