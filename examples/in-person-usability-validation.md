# In-Person Participant Addition Validation

Use this script to validate whether researchers can discover how to add a second participant during moderated in-person studies.

## Test setup

1. Open an instrumented prototype with Recap enabled.
2. Ask a researcher to "add a second participant session."
3. Observe without prompting.

## Success criteria

- Researcher finds the `Session` tooltip or inline hint without facilitator help.
- Researcher opens a second tab and starts participant two.
- Task completes in under 30 seconds.

## Metrics to capture

- Time-to-add-second-participant (seconds)
- Number of missteps before opening a new tab
- Task success (`yes`/`no`)
- Clarity rating (1-5): "How clear was adding another participant?"

## Recommended sample

- Run 5-8 moderated sessions pre-change and post-change.
- Compare median task time and task success rates.

## Optional instrumentation check

Use browser console listeners during sessions:

```js
window.addEventListener('recap:participant-guidance', (event) => {
  console.log('participant-guidance', event.detail);
});
```

Expected actions: `tooltip_opened`, `open_tab_clicked`.
