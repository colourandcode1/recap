import { useEffect as r } from "react";
import { Recap as f } from "./index.js";
function c({
  sessionName: o,
  showPanel: i,
  endpoint: t,
  shortcut: d,
  stripQueryParams: e
}) {
  return r(() => (f.init({
    ...o !== void 0 ? { sessionName: o } : {},
    ...i !== void 0 ? { showPanel: i } : {},
    ...t !== void 0 ? { endpoint: t } : {},
    ...d !== void 0 ? { shortcut: d } : {},
    ...e !== void 0 ? { stripQueryParams: e } : {}
  }), () => {
    f.destroy();
  }), []), null;
}
export {
  c as Recap,
  c as RecapComponent,
  c as default
};
