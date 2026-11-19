import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { defaultHubDatepickerConfig, HubDatepickerConfig } from '../interfaces/datepicker.interface';
import { defaultHubFileInputLabels, HubFileInputLabels } from '../interfaces/file-input.interface';
import {
	defaultHubColorConfig,
	defaultHubPasswordLabels,
	HubColorConfig,
	HubPasswordLabels
} from '../interfaces/input.interface';
import { defaultInvalidFeedback } from '../shared/hub-error-display';

/** Built-in motions for validation messages; `none` shows and hides them at once. */
export type HubFeedbackAnimationPreset = 'collapse' | 'fade' | 'slide' | 'none';

/**
 * Your own motion for validation messages: CSS classes Angular adds while the message
 * enters and while it leaves. Their rules must be global (not encapsulated in a component),
 * because the class lands on the field's feedback element.
 */
export interface HubFeedbackAnimationClasses {
	/** Classes added while the message appears (an `animation` or a `transition` on them). */
	enter: string;
	/** Classes added while the message goes; without them it is removed at once. */
	leave?: string;
}

/** How validation messages appear and go: a built-in preset or your own classes. */
export type HubFeedbackAnimation = HubFeedbackAnimationPreset | HubFeedbackAnimationClasses;

/**
 * Global configuration contract for `ng-hub-ui-forms`.
 */
export interface HubFormsConfig {
	/**
	 * Builds the message shown for a given validation error.
	 *
	 * @param key - The validation error key (e.g. `required`, `min`).
	 * @param value - The error payload stored on the control.
	 * @returns The message string (HTML allowed).
	 */
	invalidFeedbackTemplateFn: (key: string, value: any) => string;

	/**
	 * Whether fields render the opt-in valid/success state by default once they
	 * are touched and valid. `false` keeps the success state off everywhere
	 * (only invalid is automatic); a per-field `showValid` input overrides this.
	 */
	showValid: boolean;

	/**
	 * How the validation messages under a field appear and go. `collapse` (the default) opens
	 * the space the message needs while it fades in, so the fields below slide instead of
	 * jumping; `fade` and `slide` keep the jump and only soften the text; `none` turns motion
	 * off. Pass {@link HubFeedbackAnimationClasses} for your own. Every built-in preset stops
	 * under `prefers-reduced-motion`.
	 */
	feedbackAnimation: HubFeedbackAnimation;

	/** Global datepicker defaults (locale labels, formats, first day of week…). */
	datepicker: HubDatepickerConfig;

	/** Global file-input labels (button text, accessible names, size and rejection formatting). */
	fileInput: HubFileInputLabels;

	/** Global password labels (toggle accessible names, Caps Lock hint, strength levels). */
	password: HubPasswordLabels;

	/**
	 * Global colour settings: an application palette for colour fields without `swatches` of their
	 * own (none by default, so they stay the classic hex field), and the accessible names of the
	 * grid's custom-colour swatch and of the classic field's colour square.
	 */
	color: HubColorConfig;
}

/**
 * Default configuration used when {@link provideHubForms} is not called.
 */
export const defaultHubFormsConfig: HubFormsConfig = {
	invalidFeedbackTemplateFn: defaultInvalidFeedback,
	showValid: false,
	feedbackAnimation: 'collapse',
	datepicker: defaultHubDatepickerConfig,
	fileInput: defaultHubFileInputLabels,
	password: defaultHubPasswordLabels,
	color: defaultHubColorConfig
};

/**
 * Injection token holding the resolved {@link HubFormsConfig}.
 *
 * Falls back to {@link defaultHubFormsConfig} when no provider is registered, so the library works
 * out of the box without bootstrapping.
 */
export const HUB_FORMS_CONFIG = new InjectionToken<HubFormsConfig>('HUB_FORMS_CONFIG', {
	providedIn: 'root',
	factory: () => defaultHubFormsConfig
});

/**
 * Registers a global configuration for `ng-hub-ui-forms`.
 *
 * @param config - Partial configuration; unspecified fields keep their defaults.
 * @returns Environment providers to add to `bootstrapApplication` (or a route's providers).
 *
 * @example
 * ```ts
 * bootstrapApplication(App, {
 *   providers: [
 *     provideHubForms({
 *       invalidFeedbackTemplateFn: (key) => myI18n.translate(`errors.${key}`)
 *     })
 *   ]
 * });
 * ```
 */
export function provideHubForms(config?: DeepPartial<HubFormsConfig>): EnvironmentProviders {
	const datepicker: HubDatepickerConfig = {
		...defaultHubFormsConfig.datepicker,
		...config?.datepicker,
		labels: { ...defaultHubFormsConfig.datepicker.labels, ...config?.datepicker?.labels }
	};

	const fileInput: HubFileInputLabels = {
		...defaultHubFormsConfig.fileInput,
		...(config?.fileInput as Partial<HubFileInputLabels> | undefined)
	};

	const password: HubPasswordLabels = {
		...defaultHubFormsConfig.password,
		...(config?.password as Partial<HubPasswordLabels> | undefined)
	};

	const color: HubColorConfig = {
		...defaultHubFormsConfig.color,
		...(config?.color as Partial<HubColorConfig> | undefined)
	};

	return makeEnvironmentProviders([
		{
			provide: HUB_FORMS_CONFIG,
			useValue: { ...defaultHubFormsConfig, ...config, datepicker, fileInput, password, color } as HubFormsConfig
		}
	]);
}

/** Recursively-optional version of a type, for partial config overrides. */
type DeepPartial<T> = {
	[K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
