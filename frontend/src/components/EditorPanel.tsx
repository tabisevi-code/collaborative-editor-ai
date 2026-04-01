import TextareaAutosize from "react-textarea-autosize";

interface EditorPanelProps {
  label: string;
  value: string;
  onChange(nextValue: string): void;
  readOnly?: boolean;
  hint: string;
}

/**
 * A textarea-based editor keeps content strictly plain text so it remains
 * compatible with the current backend contract while still feeling usable.
 */
export function EditorPanel({ label, value, onChange, readOnly = false, hint }: EditorPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{label}</h2>
      </div>
      <label className="editor-label">
        <span className="field-label">{label}</span>
        <TextareaAutosize
          className="editor-input"
          minRows={12}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          readOnly={readOnly}
          aria-label={label}
        />
      </label>
      <p className="field-hint">{hint}</p>
    </section>
  );
}
