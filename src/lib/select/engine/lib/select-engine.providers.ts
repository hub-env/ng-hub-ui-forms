import { DefaultSelectionModelFactory } from './selection-model';
import { SELECTION_MODEL_FACTORY } from './select-engine/select-engine.component';

/**
 * Registers the default selection-model factory for the select engine. Only needed where the
 * token must resolve explicitly (tests); the component falls back to the same factory when
 * nothing provides it.
 */
export function provideSelectEngine() {
	return [
		{
			provide: SELECTION_MODEL_FACTORY,
			useValue: DefaultSelectionModelFactory
		}
	];
}
