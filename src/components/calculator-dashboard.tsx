"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ProjectionTable } from "@/components/projection-table";
import {
  calculateProjection,
  defaultInputs,
  PROJECTION_YEARS,
  type CalculatorInputs,
  type EventType,
} from "@/lib/calculator";

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
type FormEvent = {
  id: string;
  endYear: string;
  type: EventType;
  amount: string;
};
type FormState = {
  startingBalance: string;
  annualReturn: string;
  annualInflation: string;
  monthlyWithdrawal: string;
  events: FormEvent[];
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

function createExampleForm(): FormState {
  return {
    startingBalance: String(defaultInputs.startingBalance),
    annualReturn: String(defaultInputs.annualReturn * 100),
    annualInflation: String(defaultInputs.annualInflation * 100),
    monthlyWithdrawal: String(defaultInputs.monthlyWithdrawal),
    events: defaultInputs.events.map((event) => ({
      ...event,
      endYear: String(event.endYear),
      amount: String(event.amount),
    })),
  };
}

const readNumber = (value: string) =>
  value.trim() === "" ? Number.NaN : Number(value);

function parseForm(form: FormState): CalculatorInputs {
  return {
    startingBalance: readNumber(form.startingBalance),
    annualReturn: readNumber(form.annualReturn) / 100,
    annualInflation: readNumber(form.annualInflation) / 100,
    monthlyWithdrawal: readNumber(form.monthlyWithdrawal),
    events: form.events.map((event) => ({
      ...event,
      endYear: readNumber(event.endYear),
      amount: readNumber(event.amount),
    })),
  };
}

function getFieldErrors(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of ["startingBalance", "monthlyWithdrawal"] as const) {
    const value = readNumber(form[field]);
    if (!Number.isFinite(value) || value < 0)
      errors[field] = "Enter an amount of $0 or more.";
  }
  const annualReturn = readNumber(form.annualReturn);
  if (!Number.isFinite(annualReturn) || annualReturn < -100)
    errors.annualReturn = "Enter a return of -100% or more.";
  const annualInflation = readNumber(form.annualInflation);
  if (!Number.isFinite(annualInflation) || annualInflation <= -100)
    errors.annualInflation = "Enter inflation greater than -100%.";
  form.events.forEach((event) => {
    const year = readNumber(event.endYear);
    const amount = readNumber(event.amount);
    if (!Number.isInteger(year) || year < 1 || year > PROJECTION_YEARS)
      errors[`year-${event.id}`] =
        `Choose an end year from 1 to ${PROJECTION_YEARS}.`;
    if (!Number.isFinite(amount) || amount < 0)
      errors[`amount-${event.id}`] = "Enter an amount of $0 or more.";
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
  onChange,
  onBlur,
}: NumberFieldProps) {
  return (
    <div>
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
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="any"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={
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

export default function CalculatorDashboard() {
  const [form, setForm] = useState<FormState>(createEmptyForm);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
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

  const markTouched = (key: string) =>
    setTouched((current) => ({ ...current, [key]: true }));
  const errorFor = (key: string) =>
    touched[key] ? fieldErrors[key] : undefined;
  const updateField = (field: MainField, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));
  const updateEvent = (id: string, changes: Partial<FormEvent>) =>
    setForm((current) => ({
      ...current,
      events: current.events.map((event) =>
        event.id === id ? { ...event, ...changes } : event,
      ),
    }));
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
        className="mx-auto w-full max-w-[1920px] px-5 pb-20 pt-10 sm:px-8 sm:pt-14 lg:px-12"
      >
        <div className="mb-10 max-w-[820px]">
          <div className="mb-4 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-orange">
            <span className="h-px w-8 bg-orange" /> Retirement planning
          </div>
          <h1 className="max-w-[820px] text-balance text-[clamp(2.6rem,5vw,4.6rem)] font-semibold leading-[1.06] tracking-[-0.065em]">
            How long will your money last?
          </h1>
          <p className="mt-5 max-w-[670px] text-base leading-7 text-muted sm:text-lg">
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
            <div className="grid gap-5 pt-6 sm:grid-cols-2 lg:grid-cols-1">
              <NumberField
                id="startingBalance"
                label="Starting balance"
                value={form.startingBalance}
                prefix="$"
                error={errorFor("startingBalance")}
                onChange={(value) => updateField("startingBalance", value)}
                onBlur={() => markTouched("startingBalance")}
              />
              <NumberField
                id="annualReturn"
                label="Annual investment return"
                value={form.annualReturn}
                suffix="%"
                hint="Converted to an effective monthly rate."
                error={errorFor("annualReturn")}
                onChange={(value) => updateField("annualReturn", value)}
                onBlur={() => markTouched("annualReturn")}
              />
              <NumberField
                id="annualInflation"
                label="Annual inflation"
                value={form.annualInflation}
                suffix="%"
                error={errorFor("annualInflation")}
                onChange={(value) => updateField("annualInflation", value)}
                onBlur={() => markTouched("annualInflation")}
              />
              <NumberField
                id="monthlyWithdrawal"
                label="Monthly withdrawal"
                value={form.monthlyWithdrawal}
                prefix="$"
                hint="Increases annually with inflation when the opening balance is positive."
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
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Applied at the end of the selected year.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      events: [
                        ...current.events,
                        {
                          id: crypto.randomUUID(),
                          endYear: "1",
                          type: "windfall",
                          amount: "0",
                        },
                      ],
                    }))
                  }
                  className="min-h-11 shrink-0 rounded-lg border border-line px-3 text-xs font-bold transition-colors hover:border-orange hover:text-orange focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
                >
                  + Add event
                </button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {form.events.length === 0 && (
                  <p className="rounded-lg bg-[#f6f4f0] p-4 text-sm text-muted">
                    No one-off events. Add a withdrawal or windfall to test a
                    scenario.
                  </p>
                )}
                {form.events.map((event, index) => (
                  <div
                    key={event.id}
                    className="rounded-xl border border-line bg-[#fcfbf9] p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
                        Event {index + 1}
                      </span>
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
                        className="min-h-11 rounded-md px-2 text-xs font-semibold text-muted underline-offset-4 hover:text-[#a92f19] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-[74px_minmax(0,1fr)] gap-2">
                      <div>
                        <label
                          htmlFor={`year-${event.id}`}
                          className="mb-1 block text-xs font-semibold"
                        >
                          End year
                        </label>
                        <input
                          id={`year-${event.id}`}
                          type="number"
                          min="1"
                          max={PROJECTION_YEARS}
                          step="1"
                          value={event.endYear}
                          onChange={(value) =>
                            updateEvent(event.id, {
                              endYear: value.target.value,
                            })
                          }
                          onBlur={() => markTouched(`year-${event.id}`)}
                          aria-invalid={Boolean(errorFor(`year-${event.id}`))}
                          aria-describedby={
                            errorFor(`year-${event.id}`)
                              ? `year-${event.id}-error`
                              : undefined
                          }
                          className="event-control"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`type-${event.id}`}
                          className="mb-1 block text-xs font-semibold"
                        >
                          Type
                        </label>
                        <select
                          id={`type-${event.id}`}
                          value={event.type}
                          onChange={(value) =>
                            updateEvent(event.id, {
                              type: value.target.value as EventType,
                            })
                          }
                          className="event-control cursor-pointer"
                        >
                          <option value="windfall">Windfall</option>
                          <option value="withdrawal">Withdrawal</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-2">
                      <label
                        htmlFor={`amount-${event.id}`}
                        className="mb-1 block text-xs font-semibold"
                      >
                        Amount (AUD)
                      </label>
                      <input
                        id={`amount-${event.id}`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={event.amount}
                        onChange={(value) =>
                          updateEvent(event.id, { amount: value.target.value })
                        }
                        onBlur={() => markTouched(`amount-${event.id}`)}
                        aria-invalid={Boolean(errorFor(`amount-${event.id}`))}
                        aria-describedby={
                          errorFor(`amount-${event.id}`)
                            ? `amount-${event.id}-error`
                            : undefined
                        }
                        className="event-control"
                      />
                    </div>
                    {errorFor(`year-${event.id}`) && (
                      <p
                        id={`year-${event.id}-error`}
                        className="mt-2 text-xs text-[#a92f19]"
                      >
                        {errorFor(`year-${event.id}`)}
                      </p>
                    )}
                    {errorFor(`amount-${event.id}`) && (
                      <p
                        id={`amount-${event.id}-error`}
                        className="mt-2 text-xs text-[#a92f19]"
                      >
                        {errorFor(`amount-${event.id}`)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
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
                      : "Enter your starting balance, expected annual return, inflation rate, and monthly withdrawal. Your results will appear here and update as you make changes.")}
                </p>
              </div>
            ) : (
              <>
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
                  <div className="rounded-2xl border border-line bg-white p-6">
                    <p className="eyebrow">End of year 10</p>
                    <output
                      aria-label="Year 10 nominal balance"
                      className="mt-4 block text-[clamp(1.3rem,1.8vw,2rem)] font-semibold leading-tight tracking-[-0.045em] tabular-nums [overflow-wrap:anywhere]"
                    >
                      {currency.format(projection.rows[9].closingBalance)}
                    </output>
                    <p className="mt-4 text-xs leading-5 text-muted">
                      Nominal closing balance
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      <output aria-label="Year 10 balance in today's dollars">
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
                      AUD · year-end balance
                    </span>
                  </div>
                  <BalanceChart
                    rows={projection.rows}
                    startingBalance={inputs.startingBalance}
                  />
                  <p className="mt-3 text-xs leading-5 text-muted">
                    The dashed line adjusts future balances for inflation to
                    show their estimated purchasing power in today&apos;s
                    dollars.
                  </p>
                </div>
              </>
            )}
          </section>
        </div>
        {projection && (
          <section
            className="mt-10 min-w-0"
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
            <p className="mt-4 max-w-[900px] text-sm leading-6 text-muted">
              Year 0 covers the first 12 months. A negative closing balance
              shows a shortfall; the next year starts at zero. One-off events
              are applied at the end of the selected year.
            </p>
          </section>
        )}
      </main>
      <footer className="border-t border-line bg-white px-5 py-8 text-xs leading-6 text-muted sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1824px] flex-col justify-between gap-3 sm:flex-row">
          <span className="font-bold text-ink">
            Q Wealth · Planning calculator
          </span>
          <span className="max-w-[750px]">
            For general information only. Projections use the values you enter
            and assume constant returns and inflation. They are estimates, not
            financial advice or a guarantee of future results. Past performance
            is not indicative of future results. Consider speaking with a
            qualified adviser before making financial decisions.
          </span>
        </div>
      </footer>
    </div>
  );
}
