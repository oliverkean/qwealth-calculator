const decimalPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const groupedPattern = /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d*)?$/;

/** Reject malformed comma groups before converting a displayed amount to a number. */
export function parseMoneyInput(value: string): number {
  const trimmedValue = value.trim();
  const pattern = trimmedValue.includes(",") ? groupedPattern : decimalPattern;

  if (!pattern.test(trimmedValue)) {
    return Number.NaN;
  }

  return Number(trimmedValue.replaceAll(",", ""));
}

/** Group digits as text so display formatting never rounds the entered decimals. */
export function formatMoneyInput(value: string): string {
  if (!Number.isFinite(parseMoneyInput(value))) {
    return value;
  }

  const ungroupedValue = value.trim().replaceAll(",", "");
  if (/[eE]/.test(ungroupedValue)) {
    return value;
  }

  const [wholeAmount, decimals] = ungroupedValue.split(".");
  const groupedAmount = wholeAmount.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return decimals === undefined
    ? groupedAmount
    : `${groupedAmount}.${decimals}`;
}
