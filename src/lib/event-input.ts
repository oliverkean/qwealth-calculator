import { PROJECTION_YEARS, type EventType } from "@/lib/calculator";
import { parseMoneyInput } from "@/lib/money-input";

export type EventDraft = {
  id: string;
  projectionYear: string;
  type: EventType;
  amount: string;
};

/** Validate the editable draft before adding it to the active scenario. */
export function getEventFieldErrors(event: EventDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  const year = Number(event.projectionYear);
  const amount = parseMoneyInput(event.amount);
  if (event.projectionYear.trim() === "") {
    errors[`year-${event.id}`] = "Enter a projection year.";
  } else if (!Number.isInteger(year) || year < 0 || year >= PROJECTION_YEARS) {
    errors[`year-${event.id}`] =
      `Choose a whole year from 0 to ${PROJECTION_YEARS - 1}.`;
  }
  if (event.amount.trim() === "") {
    errors[`amount-${event.id}`] = "Enter an event amount.";
  } else if (!Number.isFinite(amount)) {
    errors[`amount-${event.id}`] = "Enter a valid amount.";
  } else if (amount < 0) {
    errors[`amount-${event.id}`] = "Amount cannot be negative.";
  }
  return errors;
}
