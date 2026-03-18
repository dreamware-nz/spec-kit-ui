import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'

export function createEditor(
  container: HTMLElement,
  content: string,
  onChange: (content: string) => void,
): EditorView {
  const state = EditorState.create({
    doc: content,
    extensions: [
      markdown(),
      EditorView.lineWrapping,
      keymap.of([...defaultKeymap, ...historyKeymap]),
      history(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString())
        }
      }),
    ],
  })

  const view = new EditorView({
    state,
    parent: container,
  })

  return view
}
