"use client";

import { useState } from "react";
import { formatMoneyInput } from "@/lib/money-input";

type NumericInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  descriptionId?: string;
  inputMode?: "decimal" | "numeric";
  formatAsMoney?: boolean;
  className: string;
};

/**
 * Preserve editable strings, including blanks and unfinished decimals.
 * Group money after editing so typing and cursor movement do not trigger reformatting.
 */
export function NumericInput({
  id,
  value,
  onChange,
  onBlur,
  error,
  descriptionId,
  inputMode = "decimal",
  formatAsMoney = false,
  className,
}: NumericInputProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <input
      id={id}
      type="text"
      inputMode={inputMode}
      value={formatAsMoney && !isEditing ? formatMoneyInput(value) : value}
      onChange={(event) => {
        setIsEditing(true);
        onChange(event.target.value);
      }}
      onFocus={(event) => {
        if (event.currentTarget.value === "0") {
          event.currentTarget.select();
        }
      }}
      onBlur={() => {
        setIsEditing(false);
        onBlur();
      }}
      aria-invalid={Boolean(error)}
      aria-describedby={descriptionId}
      className={className}
    />
  );
}
