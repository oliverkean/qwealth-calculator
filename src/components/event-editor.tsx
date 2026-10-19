"use client";

import { useEffect, useRef, useState } from "react";
import { NumericInput } from "@/components/numeric-input";
import { getEventFieldErrors, type EventDraft } from "@/lib/event-input";
import type { EventType } from "@/lib/calculator";

type EventEditorProps = {
  event: EventDraft;
  isNew: boolean;
  onSave: (event: EventDraft) => void;
  onCancel: () => void;
};

/** Keep unsaved changes separate from the scenario; the native dialog contains focus. */
export function EventEditor({
  event,
  isNew,
  onSave,
  onCancel,
}: EventEditorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(event);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const errors = getEventFieldErrors(draft);
  const yearId = `year-${draft.id}`;
  const amountId = `amount-${draft.id}`;
  const yearError = touched[yearId] ? errors[yearId] : undefined;
  const amountError = touched[amountId] ? errors[amountId] : undefined;
  const buttonClass =
    "min-h-11 rounded-lg border border-line px-4 text-sm font-semibold transition-colors hover:border-orange hover:text-orange focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange";

  useEffect(() => {
    const dialog = dialogRef.current!;
    const trigger = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="event-editor-heading"
      aria-describedby="event-editor-hint"
      onKeyDown={(event) => {
        if (
          event.key !== "Tab" ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey
        )
          return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>(
          "input, select, button",
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-line bg-white p-5 text-ink shadow-xl backdrop:bg-ink/40 sm:p-6"
    >
      <form
        noValidate
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          setTouched({ [yearId]: true, [amountId]: true });
          if (Object.keys(errors).length > 0) {
            document.getElementById(Object.keys(errors)[0])?.focus();
            return;
          }
          onSave({
            ...draft,
            projectionYear: String(Number(draft.projectionYear)),
          });
        }}
      >
        <h2
          id="event-editor-heading"
          className="text-xl font-semibold tracking-[-0.035em]"
        >
          {isNew ? "Add one-off event" : "Edit one-off event"}
        </h2>
        <p id="event-editor-hint" className="mt-2 text-sm leading-6 text-muted">
          Applied at the end of the selected projection year. Year 0 covers the
          first 12 months.
        </p>
        <div className="mt-5 grid grid-cols-[110px_minmax(0,1fr)] gap-3">
          <div>
            <label
              htmlFor={yearId}
              className="mb-2 block text-sm font-semibold"
            >
              Projection year
            </label>
            <NumericInput
              id={yearId}
              inputMode="numeric"
              value={draft.projectionYear}
              onChange={(value) =>
                setDraft((current) => ({ ...current, projectionYear: value }))
              }
              onBlur={() =>
                setTouched((current) => ({ ...current, [yearId]: true }))
              }
              error={yearError}
              descriptionId={
                yearError ? `${yearId}-error` : "event-editor-hint"
              }
              className="event-control"
            />
            {yearError && (
              <p
                id={`${yearId}-error`}
                role="alert"
                className="mt-2 text-xs text-[#a92f19]"
              >
                {yearError}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="event-type"
              className="mb-2 block text-sm font-semibold"
            >
              Type
            </label>
            <select
              id="event-type"
              value={draft.type}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  type: event.target.value as EventType,
                }))
              }
              className="event-control cursor-pointer"
            >
              <option value="windfall">Windfall</option>
              <option value="withdrawal">Withdrawal</option>
            </select>
          </div>
        </div>
        <div className="mt-5">
          <label
            htmlFor={amountId}
            className="mb-2 block text-sm font-semibold"
          >
            Amount (AUD)
          </label>
          <NumericInput
            id={amountId}
            formatAsMoney
            value={draft.amount}
            onChange={(value) =>
              setDraft((current) => ({ ...current, amount: value }))
            }
            onBlur={() =>
              setTouched((current) => ({ ...current, [amountId]: true }))
            }
            error={amountError}
            descriptionId={amountError ? `${amountId}-error` : undefined}
            className="event-control"
          />
          {amountError && (
            <p
              id={`${amountId}-error`}
              role="alert"
              className="mt-2 text-xs text-[#a92f19]"
            >
              {amountError}
            </p>
          )}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-line pt-5">
          <button type="button" onClick={onCancel} className={buttonClass}>
            Cancel
          </button>
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
          >
            Save event
          </button>
        </div>
      </form>
    </dialog>
  );
}
