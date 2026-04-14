import type { RecapConfig } from './types.js';
export interface RecapProps extends RecapConfig {
    onExport?: (data: object) => void;
}
/**
 * Drop-in React component. Add to your app layout to enable tracking.
 *
 * @example
 * ```tsx
 * import { Recap } from 'recap-ux/react';
 * <Recap showPanel sessionName="participant-01" />
 * ```
 */
export declare function RecapComponent({ sessionName, showPanel, endpoint, shortcut, stripQueryParams, }: RecapProps): null;
export { RecapComponent as Recap };
export default RecapComponent;
