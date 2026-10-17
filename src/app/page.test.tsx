import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("calculator page", () => {
  it("renders the default scenario and workbook indexing clearly", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "How long will your money last?",
    );
    expect(
      screen.getByText("Workbook Year 21 · end of projection year 22."),
    ).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: /Year 0/ }),
    ).toBeInTheDocument();
  });

  it("updates the projection and restores defaults", async () => {
    const user = userEvent.setup();
    render(<Home />);
    const withdrawal = screen.getByRole("spinbutton", {
      name: /Monthly withdrawal/,
    });
    fireEvent.change(withdrawal, { target: { value: "0" } });
    expect(screen.getByText("51+ years")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(withdrawal).toHaveValue(10000);
    expect(screen.getAllByText("Year 21")).toHaveLength(2);
  });

  it("shows inline validation and lets users add and remove events", async () => {
    const user = userEvent.setup();
    render(<Home />);
    const balance = screen.getByRole("spinbutton", {
      name: /Starting balance/,
    });
    fireEvent.change(balance, { target: { value: "-1" } });
    fireEvent.blur(balance);
    expect(
      screen.getByText("Enter an amount of $0 or more."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Check your inputs" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "+ Add event" }));
    expect(screen.getByText("Event 4")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Remove" })[3]);
    expect(screen.queryByText("Event 4")).not.toBeInTheDocument();
  });
});
