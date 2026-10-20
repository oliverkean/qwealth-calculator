"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { NumericInput } from "@/components/numeric-input";
import { EventEditor } from "@/components/event-editor";
import { ProjectionTable } from "@/components/projection-table";
import { parseMoneyInput } from "@/lib/money-input";
import { getEventFieldErrors, type EventDraft } from "@/lib/event-input";
import {
  calculateProjection,
  defaultInputs,
  type CalculatorInputs,
} from "@/lib/calculator";

/** Render the responsive chart in the browser, where its container can be measured. */
const BalanceChart = dynamic(() => import("@/components/balance-chart"), {
  ssr: false,
  loading: () => (
    <div
      className="h-[376px] animate-pulse rounded-xl bg-[#f5f3ef] sm:h-[426px]"
      aria-label="Loading balance chart"
    />
  ),
});

const currency = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
/** Keep editable values as strings so a cleared field remains distinct from zero. */
type FormState = {
  startingBalance: string;
  annualReturn: string;
  annualInflation: string;
  monthlyWithdrawal: string;
  events: EventDraft[];
};
type MainField =
  "startingBalance" | "annualReturn" | "annualInflation" | "monthlyWithdrawal";

function createEmptyForm(): FormState {
  return {
    startingBalance: "",
    annualReturn: "",
    annualInflation: "",
    monthlyWithdrawal: "",
    events: [],
  };
}

function createInitialForm(): FormState {
  return {
    ...createEmptyForm(),
    annualReturn: String(defaultInputs.annualReturn * 100),
    annualInflation: String(defaultInputs.annualInflation * 100),
  };
}

function createExampleForm(): FormState {
  return {
    startingBalance: String(defaultInputs.startingBalance),
    annualReturn: String(defaultInputs.annualReturn * 100),
    annualInflation: String(defaultInputs.annualInflation * 100),
    monthlyWithdrawal: String(defaultInputs.monthlyWithdrawal),
    events: defaultInputs.events.map((event) => ({
      id: event.id,
      projectionYear: String(event.endYear - 1),
      type: event.type,
      amount: String(event.amount),
    })),
  };
}

/** Treat a blank input as invalid instead of letting Number("") turn it into zero. */
const readNumber = (value: string) =>
  value.trim() === "" ? Number.NaN : Number(value);

/**
 * Convert form strings into engine inputs; a displayed 7.5% becomes 0.075.
 * Projection year 0 ends the first annual period, so its engine end-year is 1.
 */
function parseForm(form: FormState): CalculatorInputs {
  return {
    startingBalance: parseMoneyInput(form.startingBalance),
    annualReturn: readNumber(form.annualReturn) / 100,
    annualInflation: readNumber(form.annualInflation) / 100,
    monthlyWithdrawal: parseMoneyInput(form.monthlyWithdrawal),
    events: form.events.map((event) => ({
      id: event.id,
      endYear: readNumber(event.projectionYear) + 1,
      type: event.type,
      amount: parseMoneyInput(event.amount),
    })),
  };
}

/**
 * Return form validation messages keyed by control ID, including stable event IDs.
 * The calculation engine validates its numeric inputs independently.
 */
function getFieldErrors(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of ["startingBalance", "monthlyWithdrawal"] as const) {
    const value = parseMoneyInput(form[field]);
    if (form[field].trim() === "") {
      errors[field] =
        field === "startingBalance"
          ? "Enter a starting balance."
          : "Enter a monthly withdrawal.";
    } else if (!Number.isFinite(value)) {
      errors[field] = "Enter a valid amount.";
    } else if (value < 0) {
      errors[field] = "Amount cannot be negative.";
    }
  }
  const annualReturn = readNumber(form.annualReturn);
  if (form.annualReturn.trim() === "") {
    errors.annualReturn = "Enter an average annual return.";
  } else if (!Number.isFinite(annualReturn)) {
    errors.annualReturn = "Enter a valid percentage.";
  } else if (annualReturn < -100) {
    errors.annualReturn = "Return cannot be below -100%.";
  }
  const annualInflation = readNumber(form.annualInflation);
  if (form.annualInflation.trim() === "") {
    errors.annualInflation = "Enter an average annual inflation rate.";
  } else if (!Number.isFinite(annualInflation)) {
    errors.annualInflation = "Enter a valid percentage.";
  } else if (annualInflation <= -100) {
    errors.annualInflation = "Inflation must be above -100%.";
  }
  form.events.forEach((event) => {
    Object.assign(errors, getEventFieldErrors(event));
  });
  return errors;
}

type NumberFieldProps = {
  id: string;
  label: string;
  value: string;
  prefix?: string;
  suffix?: string;
  hint?: string;
  error?: string;
  formatAsMoney?: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
};

function NumberField({
  id,
  label,
  value,
  prefix,
  suffix,
  hint,
  error,
  formatAsMoney,
  onChange,
  onBlur,
}: NumberFieldProps) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-ink">
        {label}
      </label>
      <div
        className={`flex h-12 items-center rounded-lg border bg-white transition-colors focus-within:border-ink focus-within:ring-2 focus-within:ring-orange/20 ${error ? "border-[#b54428]" : "border-line"}`}
      >
        {prefix && (
          <span aria-hidden="true" className="pl-3 text-sm text-muted">
            {prefix}
          </span>
        )}
        <NumericInput
          id={id}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          error={error}
          formatAsMoney={formatAsMoney}
          descriptionId={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-base font-medium tabular-nums text-ink outline-none"
        />
        {suffix && (
          <span aria-hidden="true" className="pr-3 text-sm text-muted">
            {suffix}
          </span>
        )}
      </div>
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 text-xs font-medium text-[#a92f19]"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs leading-5 text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Own the editable scenario in browser state and calculate it locally on input changes.
 * Valid inputs produce one projection shared by the summary, table, and chart.
 * Invalid edits clear the results; calculation failures appear in the results area.
 */
export default function CalculatorDashboard() {
  const [form, setForm] = useState<FormState>(createInitialForm);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [eventEditor, setEventEditor] = useState<{
    event: EventDraft;
    isNew: boolean;
  } | null>(null);
  const fieldErrors = useMemo(() => getFieldErrors(form), [form]);
  const inputs = useMemo(() => parseForm(form), [form]);
  const { projection, calculationError } = useMemo(() => {
    if (Object.keys(fieldErrors).length > 0)
      return { projection: null, calculationError: null };
    try {
      return {
        projection: calculateProjection(inputs),
        calculationError: null,
      };
    } catch (error) {
      return {
        projection: null,
        calculationError:
          error instanceof Error
            ? error.message
            : "Unable to calculate this scenario.",
      };
    }
  }, [fieldErrors, inputs]);

  /** Block invalid projections immediately, but show field errors after blur. */
  const markTouched = (key: string) =>
    setTouched((current) => ({ ...current, [key]: true }));
  const errorFor = (key: string) =>
    touched[key] ? fieldErrors[key] : undefined;
  const updateField = (field: MainField, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));
  const hasVisibleErrors = Object.keys(touched).some((key) =>
    Boolean(fieldErrors[key]),
  );

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-3 focus:text-white"
      >
        Skip to main content
      </a>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1920px] items-center px-5 py-4 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3" aria-label="Q Wealth">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-ink text-xl font-extrabold tracking-[-0.1em] text-white">
              Q<span className="text-orange">.</span>
            </span>
            <span className="text-[17px] font-bold tracking-[-0.04em]">
              Q Wealth
            </span>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto w-full max-w-[1920px] px-5 pb-20 pt-6 sm:px-8 sm:pt-8 lg:px-12"
      >
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-orange">
            <span className="h-px w-8 bg-orange" /> Savings projection
          </div>
          <h1 className="text-[clamp(1.875rem,3.5vw,3rem)] font-semibold leading-tight tracking-[-0.045em]">
            How long will your money last?
          </h1>
          <p className="mt-3 text-base leading-6 text-muted sm:text-lg">
            Explore how withdrawals, investment returns, inflation, and one-off
            events shape your balance over time.
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[370px_minmax(0,1fr)]">
          <aside className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-[0_8px_30px_rgb(28_28_26_/_0.025)] sm:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
              <div>
                <h2 className="text-xl font-semibold tracking-[-0.035em]">
                  Calculator inputs
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setForm(createEmptyForm());
                  setTouched({});
                }}
                className="min-h-11 rounded-md px-2 text-xs font-semibold text-orange underline-offset-4 transition-colors hover:text-[#aa421c] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
              >
                Clear
              </button>
            </div>
            <p className="mt-5 text-sm leading-6 text-muted">
              Enter the values for the person using this calculator. Every
              result is calculated from these inputs.
            </p>
            <button
              type="button"
              onClick={() => {
                setForm(createExampleForm());
                setTouched({});
              }}
              className="mt-3 min-h-11 rounded-lg border border-line px-4 text-sm font-semibold transition-colors hover:border-orange hover:text-orange focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
            >
              Load example
            </button>
            <div className="grid grid-cols-1 gap-5 pt-6 sm:grid-cols-2 lg:grid-cols-1">
              <NumberField
                id="startingBalance"
                label="Starting balance"
                formatAsMoney
                value={form.startingBalance}
                prefix="$"
                error={errorFor("startingBalance")}
                onChange={(value) => updateField("startingBalance", value)}
                onBlur={() => markTouched("startingBalance")}
              />
              <NumberField
                id="annualReturn"
                label="Average annual investment return"
                value={form.annualReturn}
                suffix="%"
                error={errorFor("annualReturn")}
                onChange={(value) => updateField("annualReturn", value)}
                onBlur={() => markTouched("annualReturn")}
              />
              <NumberField
                id="annualInflation"
                label="Average annual inflation"
                value={form.annualInflation}
                suffix="%"
                error={errorFor("annualInflation")}
                onChange={(value) => updateField("annualInflation", value)}
                onBlur={() => markTouched("annualInflation")}
              />
              <NumberField
                id="monthlyWithdrawal"
                label="Monthly withdrawal"
                formatAsMoney
                value={form.monthlyWithdrawal}
                prefix="$"
                hint="Adjusted yearly for inflation."
                error={errorFor("monthlyWithdrawal")}
                onChange={(value) => updateField("monthlyWithdrawal", value)}
                onBlur={() => markTouched("monthlyWithdrawal")}
              />
            </div>

            <div className="mt-8 border-t border-line pt-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold tracking-[-0.02em]">
                    One-off events
                  </h3>
                  <p
                    id="event-year-hint"
                    className="mt-1 text-xs leading-5 text-muted"
                  >
                    Applied at the end of the selected projection year. Year 0
                    covers the first 12 months.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEventEditor({
                      event: {
                        id: crypto.randomUUID(),
                        projectionYear: "0",
                        type: "windfall",
                        amount: "0",
                      },
                      isNew: true,
                    })
                  }
                  className="min-h-11 shrink-0 rounded-lg border border-line px-3 text-xs font-bold transition-colors hover:border-orange hover:text-orange focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
                >
                  + Add event
                </button>
              </div>
              {form.events.length === 0 ? (
                <p className="mt-4 rounded-lg bg-[#f6f4f0] p-4 text-sm text-muted">
                  No one-off events. Add a withdrawal or windfall to test a
                  scenario.
                </p>
              ) : (
                <ul
                  aria-label="One-off event list"
                  className="mt-4 max-h-80 space-y-2 overflow-y-auto rounded-xl border border-line p-2"
                >
                  {form.events.map((event, index) => (
                    <li
                      key={event.id}
                      aria-label={`Event ${index + 1}`}
                      className="rounded-lg bg-[#fcfbf9] px-3 py-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            {event.type === "windfall"
                              ? "Windfall"
                              : "Withdrawal"}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            End of Year {event.projectionYear}
                          </p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums [overflow-wrap:anywhere]">
                          {currency.format(parseMoneyInput(event.amount))}
                        </p>
                      </div>
                      <div className="mt-1 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEventEditor({ event, isNew: false })
                          }
                          className="min-h-11 rounded-md px-3 text-xs font-semibold text-muted hover:text-orange focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              events: current.events.filter(
                                (item) => item.id !== event.id,
                              ),
                            }))
                          }
                          className="min-h-11 rounded-md px-3 text-xs font-semibold text-muted hover:text-[#a92f19] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          <section
            className="min-w-0 space-y-6"
            aria-label="Projection results"
          >
            {!projection ? (
              <div
                className="rounded-2xl border border-line bg-white p-8"
                role="status"
              >
                <p className="eyebrow">02 / Projection</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                  {hasVisibleErrors || calculationError
                    ? "Check your inputs"
                    : "Start your projection"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {calculationError ??
                    (hasVisibleErrors
                      ? "Enter valid values in all fields to see your projection."
                      : "Enter your starting balance, average annual investment return, average annual inflation, and monthly withdrawal. Your results will appear here and update as you make changes.")}
                </p>
              </div>
            ) : (
              <>
                {/* A one-based depletion end-year becomes a zero-based shortfall label and a count of prior positive years. */}
                <div
                  className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4"
                  role="group"
                  aria-label="Projection summary"
                >
                  <div className="rounded-2xl bg-ink p-6 text-white">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">
                      Estimated duration
                    </p>
                    <output
                      aria-label="Estimated duration"
                      className="mt-4 block text-[clamp(1.75rem,2.5vw,2.25rem)] font-semibold leading-none tracking-[-0.05em]"
                    >
                      {projection.depletionEndYear === null
                        ? "51+ years"
                        : `${projection.depletionEndYear - 1} years`}
                    </output>
                    <p className="mt-4 text-xs leading-5 text-white/65">
                      {projection.depletionEndYear === null
                        ? "Balance stays positive through the model horizon."
                        : "Full years with a positive closing balance before the first shortfall."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-line bg-white p-6">
                    <p className="eyebrow">First shortfall</p>
                    <output
                      aria-label="First shortfall year"
                      className="mt-4 block text-[clamp(1.5rem,2.4vw,2.25rem)] font-semibold leading-none tracking-[-0.055em]"
                    >
                      {projection.depletionEndYear === null
                        ? "Not reached"
                        : `Year ${projection.depletionEndYear - 1}`}
                    </output>
                    <p className="mt-4 text-xs leading-5 text-muted">
                      {projection.depletionEndYear === null
                        ? "Your balance stays positive across all 51 projected years."
                        : `End of the ${projection.depletionEndYear}-year period. The projection starts at Year 0.`}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-line bg-white p-6">
                    <p className="eyebrow">Starting balance</p>
                    <output
                      aria-label="Starting balance result"
                      className="mt-4 block text-[clamp(1.3rem,1.8vw,2rem)] font-semibold leading-tight tracking-[-0.045em] tabular-nums [overflow-wrap:anywhere]"
                    >
                      {currency.format(inputs.startingBalance)}
                    </output>
                    <p className="mt-4 text-xs leading-5 text-muted">
                      Your opening amount
                    </p>
                  </div>
                  {/* Row index 9 closes the tenth year because the first row is Year 0. */}
                  <div className="rounded-2xl border border-line bg-white p-6">
                    <p className="eyebrow">After 10 years</p>
                    <output
                      aria-label="Nominal balance after 10 years"
                      className="mt-4 block text-[clamp(1.3rem,1.8vw,2rem)] font-semibold leading-tight tracking-[-0.045em] tabular-nums [overflow-wrap:anywhere]"
                    >
                      {currency.format(projection.rows[9].closingBalance)}
                    </output>
                    <p className="mt-4 text-xs leading-5 text-muted">
                      Nominal closing balance
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      End of projection Year 9
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      <output aria-label="Balance after 10 years in today's dollars">
                        {currency.format(projection.rows[9].closingTodayValue)}
                      </output>{" "}
                      in today&apos;s dollars
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-line bg-white p-5 sm:p-7">
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="eyebrow">02 / Balance over time</p>
                      <h2 className="mt-2 text-xl font-semibold tracking-[-0.035em]">
                        Your projected path
                      </h2>
                    </div>
                    <span className="text-xs text-muted">
                      AUD · year-start balance
                    </span>
                  </div>
                  <BalanceChart
                    rows={projection.rows}
                    depletionEndYear={projection.depletionEndYear}
                  />
                  <p className="mt-3 text-xs leading-5 text-muted">
                    Each pair compares the opening balance with its purchasing
                    power in today&apos;s dollars.
                  </p>
                </div>
                <section
                  className="min-w-0"
                  aria-labelledby="annual-projection-heading"
                >
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="eyebrow">Year by year</p>
                      <h2
                        id="annual-projection-heading"
                        className="mt-2 text-xl font-semibold tracking-[-0.035em]"
                      >
                        Annual projection
                      </h2>
                    </div>
                    <span className="text-sm text-muted">
                      51 projected years · all amounts in AUD
                    </span>
                  </div>
                  <p className="mb-4 text-sm leading-6 text-muted xl:hidden">
                    Select a year to view its opening balance, withdrawals, and
                    windfalls.
                  </p>
                  <ProjectionTable rows={projection.rows} />
                  <p className="mt-4 text-sm leading-6 text-muted">
                    Year 0 covers the first 12 months. A negative closing
                    balance shows a shortfall; the next year starts at zero.
                    One-off events are applied at the end of the selected year.
                  </p>
                </section>
              </>
            )}
          </section>
        </div>
      </main>
      {eventEditor && (
        <EventEditor
          key={eventEditor.event.id}
          event={eventEditor.event}
          isNew={eventEditor.isNew}
          onCancel={() => setEventEditor(null)}
          onSave={(event) => {
            setForm((current) => ({
              ...current,
              events: eventEditor.isNew
                ? [...current.events, event]
                : current.events.map((item) =>
                    item.id === event.id ? event : item,
                  ),
            }));
            setEventEditor(null);
          }}
        />
      )}
      <footer className="border-t border-line bg-white px-5 py-8 text-xs leading-6 text-muted sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1824px] flex-col justify-between gap-3 sm:flex-row">
          <span className="font-bold text-ink">
            Q Wealth · Planning calculator
          </span>
        </div>
      </footer>
    </div>
  );
}
