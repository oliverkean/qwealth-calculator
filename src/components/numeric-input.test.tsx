import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { NumericInput } from "./numeric-input";

function EditableInput({
  initialValue,
  formatAsMoney,
}: {
  initialValue: string;
  formatAsMoney: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <>
      <label htmlFor="amount">Amount</label>
      <NumericInput
        id="amount"
        value={value}
        onChange={setValue}
        onBlur={() => {}}
        formatAsMoney={formatAsMoney}
        className=""
      />
      <button type="button">Next</button>
    </>
  );
}

describe("numeric input editing", () => {
  it("keeps focus from rewriting a grouped value and preserves middle-of-number edits", async () => {
    const user = userEvent.setup();
    render(<EditableInput initialValue="1350000.50" formatAsMoney />);
    const input = screen.getByRole("textbox", {
      name: "Amount",
    }) as HTMLInputElement;
    expect(input).toHaveValue("1,350,000.50");
    await user.click(input);
    expect(input).toHaveValue("1,350,000.50");
    input.setSelectionRange(3, 4);
    await user.keyboard("6");
    expect(input).toHaveValue("1,360,000.50");
    expect(input.selectionStart).toBe(4);
    await user.keyboard("{Control>}a{/Control}1500");
    expect(input).toHaveValue("1500");
    await user.tab();
    expect(input).toHaveValue("1,500");
  });

  it.each([false, true])(
    "lets a user backspace zero and enter a replacement (money: %s)",
    async (formatAsMoney) => {
      const user = userEvent.setup();
      render(<EditableInput initialValue="0" formatAsMoney={formatAsMoney} />);
      const input = screen.getByRole("textbox", { name: "Amount" });
      await user.click(input);
      await user.keyboard("{Backspace}");
      expect(input).toHaveValue("");
      await user.tab();
      expect(input).toHaveValue("");
      await user.type(input, "1500");
      expect(input).toHaveValue("1500");
      await user.tab();
      expect(input).toHaveValue(formatAsMoney ? "1,500" : "1500");
    },
  );

  it("replaces a selected zero and preserves decimals and the cursor during editing", async () => {
    const user = userEvent.setup();
    render(<EditableInput initialValue="0" formatAsMoney />);
    const input = screen.getByRole("textbox", {
      name: "Amount",
    }) as HTMLInputElement;
    await user.click(input);
    await user.keyboard("1234567.8900");
    expect(input).toHaveValue("1234567.8900");
    input.setSelectionRange(4, 4);
    await user.keyboard("9");
    expect(input).toHaveValue("12349567.8900");
    expect(input.selectionStart).toBe(5);
    await user.tab();
    expect(input).toHaveValue("12,349,567.8900");
  });

  it("accepts a pasted comma-separated amount and keeps invalid text editable", async () => {
    const user = userEvent.setup();
    render(<EditableInput initialValue="" formatAsMoney />);
    const input = screen.getByRole("textbox", { name: "Amount" });
    await user.click(input);
    await user.paste("1,350,000.50");
    await user.tab();
    expect(input).toHaveValue("1,350,000.50");
    await user.clear(input);
    await user.paste("1,35");
    await user.tab();
    expect(input).toHaveValue("1,35");
  });
});
