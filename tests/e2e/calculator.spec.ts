import { test, expect, type Page } from "@playwright/test";
import fixtures from "../../src/test/fixtures/excel-scenarios.json";

const money = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const chartName = /Line chart of nominal and inflation-adjusted/;
const browserErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      errors.push(`${message.type()}: ${message.text()}`);
    }
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page), "Browser errors and warnings").toEqual([]);
});

async function fillInputs(
  page: Page,
  inputs: {
    startingBalance: number;
    annualReturn: number;
    annualInflation: number;
    monthlyWithdrawal: number;
  },
) {
  for (const [name, value] of [
    ["Starting balance", inputs.startingBalance],
    ["Average annual investment return", inputs.annualReturn * 100],
    ["Average annual inflation", inputs.annualInflation * 100],
    ["Monthly withdrawal", inputs.monthlyWithdrawal],
  ] as const) {
    await page
      .getByRole("spinbutton", { name, exact: true })
      .fill(String(value));
  }
}

async function expectRows(page: Page, rows: number[][]) {
  await page
    .getByRole("combobox", { name: "Years per page" })
    .selectOption("51");
  const expected = rows.map((row) => row.map((value) => money.format(value)));
  if (page.viewportSize()!.width >= 1280) {
    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    await expect
      .poll(() =>
        table
          .locator("tbody tr")
          .evaluateAll((elements) =>
            elements.map((row) =>
              Array.from(
                row.querySelectorAll("td"),
                (cell) => cell.textContent,
              ),
            ),
          ),
      )
      .toEqual(expected);
  } else {
    const cards = page
      .getByLabel("Annual projection by year")
      .locator("details");
    await expect(cards).toHaveCount(51);
    await expect
      .poll(() =>
        cards.evaluateAll((elements) =>
          elements.map((row) =>
            Array.from(row.querySelectorAll("dd"), (cell) => cell.textContent),
          ),
        ),
      )
      .toEqual(expected);
    await expect(page.getByRole("table")).toHaveCount(0);
  }
}

async function expectClosing(page: Page, year: number, amount: number) {
  await page
    .getByRole("combobox", { name: "Years per page" })
    .selectOption("51");
  const value =
    page.viewportSize()!.width >= 1280
      ? page
          .getByRole("table")
          .locator("tbody tr")
          .nth(year)
          .locator("td")
          .last()
      : page
          .getByLabel("Annual projection by year")
          .locator("details")
          .nth(year)
          .locator("dd")
          .last();
  await expect(value).toHaveText(money.format(amount));
}

async function expectChart(page: Page) {
  const chart = page.getByRole("img", { name: chartName });
  await expect(chart).toBeVisible();
  await expect(chart.locator("path.recharts-line-curve")).toHaveCount(2);
  await expect(
    chart.locator("path.recharts-line-curve").first(),
  ).toHaveAttribute("d", /^M.+/);
  return chart;
}

test("fresh client values produce all annual rows and a real chart without overflow", async ({
  page,
}, testInfo) => {
  await expect(
    page.getByRole("heading", { name: "Start your projection" }),
  ).toBeVisible();
  await expect(
    page.getByRole("spinbutton", { name: "Starting balance", exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("spinbutton", { name: "Monthly withdrawal", exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("spinbutton", {
      name: "Average annual investment return",
      exact: true,
    }),
  ).toHaveValue("7.5");
  await expect(
    page.getByRole("spinbutton", {
      name: "Average annual inflation",
      exact: true,
    }),
  ).toHaveValue("3");
  await expect(page.getByRole("img", { name: chartName })).toHaveCount(0);
  const headingLayout = await page
    .getByRole("heading", { level: 1 })
    .evaluate((heading) => ({
      height: heading.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(heading).lineHeight),
    }));
  if (page.viewportSize()!.width >= 768) {
    expect(headingLayout.height).toBeLessThanOrEqual(
      headingLayout.lineHeight + 1,
    );
  }

  await page
    .getByRole("spinbutton", { name: "Starting balance", exact: true })
    .fill("1650000");
  await page
    .getByRole("spinbutton", { name: "Monthly withdrawal", exact: true })
    .fill("10000");
  await expectClosing(page, 0, 1_649_678.86);
  await expect(
    page.getByRole("button", { name: "Remove", exact: true }),
  ).toHaveCount(0);
  const initialChart = await expectChart(page);
  const initialPaths = await initialChart
    .locator("path.recharts-line-curve")
    .evaluateAll((paths) => paths.map((path) => path.getAttribute("d")));
  const fixture = fixtures.find((item) => item.name === "Deflation")!;
  await fillInputs(page, fixture.inputs);
  await expectRows(page, fixture.rows);
  await expect(
    page.getByLabel("Starting balance result", { exact: true }),
  ).toHaveText("$1,000,000.00");
  await expect(page.getByLabel("Year 10 nominal balance")).toHaveText(
    "$203,039.28",
  );
  await expect(
    page.getByLabel("Year 10 balance in today's dollars"),
  ).toHaveText(
    money.format(
      fixture.rows[9][5] / (1 + fixture.inputs.annualInflation) ** 10,
    ),
  );
  await expect(page.getByLabel("First shortfall year")).toHaveText("Year 12");
  const chart = await expectChart(page);
  await expect
    .poll(() =>
      chart
        .locator("path.recharts-line-curve")
        .evaluateAll((paths) => paths.map((path) => path.getAttribute("d"))),
    )
    .not.toEqual(initialPaths);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      })),
    )
    .toEqual({
      viewport: page.viewportSize()!.width,
      content: page.viewportSize()!.width,
    });

  if (page.viewportSize()!.width < 1280) {
    const lastYear = page
      .getByLabel("Annual projection by year")
      .locator("details")
      .last();
    await lastYear.locator("summary").click();
    await expect(lastYear.locator("dl")).toBeVisible();
    await expect(lastYear.locator("dt")).toHaveCount(6);
  }
  const imagePath = testInfo.outputPath("client-projection.png");
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: imagePath });
  await testInfo.attach("Client projection", {
    path: imagePath,
    contentType: "image/png",
  });
  const chartPath = testInfo.outputPath("balance-chart.png");
  await chart.screenshot({ path: chartPath });
  await testInfo.attach("Real balance chart", {
    path: chartPath,
    contentType: "image/png",
  });
});

test("Load example is optional and Clear removes all values, events, and results", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  await expectRows(
    page,
    fixtures.find((item) => item.name === "Default")!.rows,
  );
  await expect(page.getByLabel("First shortfall year")).toHaveText("Year 21");
  await expect(
    page.getByRole("button", { name: "Remove", exact: true }),
  ).toHaveCount(3);
  await expectChart(page);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  for (const input of await page.getByRole("spinbutton").all()) {
    await expect(input).toHaveValue("");
  }
  await expect(
    page.getByRole("button", { name: "Remove", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("img", { name: chartName })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Annual projection", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Start your projection" }),
  ).toBeVisible();
});

test("each main input updates displayed amounts and the actual chart paths", async ({
  page,
}) => {
  for (const [name, value, scenario] of [
    ["Starting balance", "2500000", "Larger starting balance"],
    ["Average annual investment return", "-4", "Negative return"],
    ["Average annual inflation", "0", "Zero inflation"],
    ["Monthly withdrawal", "0", "Zero withdrawals"],
  ] as const) {
    await page
      .getByRole("button", { name: "Load example", exact: true })
      .click();
    const chart = await expectChart(page);
    const previousPaths = await chart
      .locator("path.recharts-line-curve")
      .evaluateAll((paths) => paths.map((path) => path.getAttribute("d")));
    await page.getByRole("spinbutton", { name, exact: true }).fill(value);
    const fixture = fixtures.find((item) => item.name === scenario)!;
    await expectRows(page, fixture.rows);
    await expect(page.getByLabel("Year 10 nominal balance")).toHaveText(
      money.format(fixture.rows[9][5]),
    );
    await expect
      .poll(() =>
        chart
          .locator("path.recharts-line-curve")
          .evaluateAll((paths) => paths.map((path) => path.getAttribute("d"))),
      )
      .not.toEqual(previousPaths);
    await expect(page.getByLabel("First shortfall year")).toHaveText(
      fixture.depletionEndYear === null
        ? "Not reached"
        : `Year ${fixture.depletionEndYear - 1}`,
    );
  }
});

test("event year, type, amount, duplicates, and removal affect the selected annual row", async ({
  page,
}) => {
  await fillInputs(page, {
    startingBalance: 1_000_000,
    annualReturn: 0,
    annualInflation: 0,
    monthlyWithdrawal: 1000,
  });
  await expectClosing(page, 1, 976_000);
  await page.getByRole("button", { name: "+ Add event", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "End year", exact: true })
    .fill("2");
  await page
    .getByRole("spinbutton", { name: "Amount (AUD)", exact: true })
    .fill("5000");
  await expectClosing(page, 1, 981_000);
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption("withdrawal");
  await expectClosing(page, 1, 971_000);
  await page
    .getByRole("spinbutton", { name: "Amount (AUD)", exact: true })
    .fill("2000");
  await expectClosing(page, 1, 974_000);
  await page
    .getByRole("spinbutton", { name: "End year", exact: true })
    .fill("3");
  await expectClosing(page, 1, 976_000);
  await expectClosing(page, 2, 962_000);
  await page.getByRole("button", { name: "+ Add event", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "End year", exact: true })
    .last()
    .fill("3");
  await page
    .getByRole("spinbutton", { name: "Amount (AUD)", exact: true })
    .last()
    .fill("500");
  await expectClosing(page, 2, 962_500);
  await page
    .getByRole("button", { name: "Remove", exact: true })
    .first()
    .click();
  await expectClosing(page, 2, 964_500);
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expectClosing(page, 2, 964_000);
});

test("invalid main fields hide results and recover after correction", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  for (const [name, invalid, message] of [
    ["Starting balance", "-1", "Amount cannot be negative."],
    ["Monthly withdrawal", "-1", "Amount cannot be negative."],
    [
      "Average annual investment return",
      "-101",
      "Return cannot be below -100%.",
    ],
    ["Average annual inflation", "-100", "Inflation must be above -100%."],
    ["Average annual inflation", "-101", "Inflation must be above -100%."],
    ["Starting balance", "", "Enter a starting balance."],
    ["Monthly withdrawal", "", "Enter a monthly withdrawal."],
    ["Average annual investment return", "", "Enter an average annual return."],
    ["Average annual inflation", "", "Enter an average annual inflation rate."],
  ] as const) {
    const input = page.getByRole("spinbutton", { name, exact: true });
    const original = await input.inputValue();
    await input.fill(invalid);
    await input.press("Tab");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAccessibleDescription(message);
    await expect(
      page.getByRole("heading", { name: "Check your inputs" }),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: chartName })).toHaveCount(0);
    await input.fill(original);
    await expect(input).toHaveAttribute("aria-invalid", "false");
    await expect(page.getByLabel("First shortfall year")).toHaveText("Year 21");
  }
});

test("event validation rejects invalid years and amounts and permits the last year", async ({
  page,
}) => {
  await fillInputs(page, {
    startingBalance: 1000,
    annualReturn: 0,
    annualInflation: 0,
    monthlyWithdrawal: 0,
  });
  await page.getByRole("button", { name: "+ Add event", exact: true }).click();
  const year = page.getByRole("spinbutton", { name: "End year", exact: true });
  const amount = page.getByRole("spinbutton", {
    name: "Amount (AUD)",
    exact: true,
  });
  for (const invalid of ["", "0", "52", "1.5"]) {
    await year.fill(invalid);
    await year.press("Tab");
    await expect(year).toHaveAttribute("aria-invalid", "true");
    await expect(year).toHaveAccessibleDescription(
      invalid === ""
        ? "Enter an event year."
        : "Choose a whole year from 1 to 51.",
    );
    await expect(
      page.getByRole("heading", { name: "Check your inputs" }),
    ).toBeVisible();
  }
  await year.fill("51");
  await amount.fill("");
  await amount.press("Tab");
  await expect(amount).toHaveAccessibleDescription("Enter an event amount.");
  await amount.fill("-1");
  await amount.press("Tab");
  await expect(amount).toHaveAttribute("aria-invalid", "true");
  await expect(amount).toHaveAccessibleDescription(
    "Amount cannot be negative.",
  );
  await amount.fill("1234.56");
  await expect(year).toHaveAttribute("aria-invalid", "false");
  await expect(amount).toHaveAttribute("aria-invalid", "false");
  await expectClosing(page, 49, 1000);
  await expectClosing(page, 50, 2234.56);
});

test("zero return and exact depletion remain finite and numeric overflow is explained", async ({
  page,
}) => {
  const fixture = fixtures.find(
    (item) => item.name === "Exact zero closing balance",
  )!;
  await fillInputs(page, fixture.inputs);
  await expectRows(page, fixture.rows);
  await expect(page.getByLabel("First shortfall year")).toHaveText("Year 0");
  await expectChart(page);
  await page
    .getByRole("spinbutton", { name: "Starting balance", exact: true })
    .fill("1e308");
  await page
    .getByRole("spinbutton", {
      name: "Average annual investment return",
      exact: true,
    })
    .fill("7.5");
  await expect(
    page.getByText("This scenario exceeds the calculator's numeric range."),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: chartName })).toHaveCount(0);
  await page
    .getByRole("spinbutton", { name: "Starting balance", exact: true })
    .fill("1200");
  await expectChart(page);
});

test("keyboard skip link works and the custom favicon is served", async ({
  page,
  request,
}) => {
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Clear", exact: true }),
  ).toBeFocused();
  const icon = page.locator('link[rel="icon"]');
  await expect(icon).toHaveAttribute("href", /icon\.svg/);
  const response = await request.get((await icon.getAttribute("href"))!);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/svg+xml");
});

test("pagination reaches every year and the table follows the chart without the sidebar gap", async ({
  page,
}, testInfo) => {
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  const fixture = fixtures.find((item) => item.name === "Default")!;
  const desktop = page.viewportSize()!.width >= 1280;
  const next = page.getByRole("button", { name: "Next", exact: true });
  const previous = page.getByRole("button", { name: "Previous", exact: true });
  const size = page.getByRole("combobox", { name: "Years per page" });
  const visibleAmounts = () =>
    desktop
      ? page
          .getByRole("table")
          .locator("tbody tr")
          .evaluateAll((rows) =>
            rows.map((row) =>
              Array.from(
                row.querySelectorAll("td"),
                (cell) => cell.textContent,
              ),
            ),
          )
      : page
          .getByLabel("Annual projection by year")
          .locator("details")
          .evaluateAll((rows) =>
            rows.map((row) =>
              Array.from(
                row.querySelectorAll("dd"),
                (cell) => cell.textContent,
              ),
            ),
          );
  await expect(size).toHaveValue("10");
  await expect(previous).toBeDisabled();
  for (let pageIndex = 0; pageIndex < 6; pageIndex += 1) {
    const expected = fixture.rows
      .slice(pageIndex * 10, pageIndex * 10 + 10)
      .map((row) => row.map((value) => money.format(value)));
    await expect.poll(visibleAmounts).toEqual(expected);
    await expect(
      page.getByText(`Page ${pageIndex + 1} of 6`, { exact: true }),
    ).toBeVisible();
    if (pageIndex < 5) await next.click();
  }
  await expect(next).toBeDisabled();
  await previous.click();
  await expect(page.getByText("Page 5 of 6", { exact: true })).toBeVisible();
  await size.selectOption("25");
  await expect
    .poll(visibleAmounts)
    .toEqual(
      fixture.rows
        .slice(0, 25)
        .map((row) => row.map((value) => money.format(value))),
    );
  await expect(page.getByText("Page 1 of 3", { exact: true })).toBeVisible();
  await expect(previous).toBeDisabled();
  await size.selectOption("51");
  await expect
    .poll(visibleAmounts)
    .toEqual(
      fixture.rows.map((row) => row.map((value) => money.format(value))),
    );
  await expect(next).toBeDisabled();
  await size.selectOption("10");

  const chart = await expectChart(page);
  const annual = page.getByRole("region", {
    name: "Annual projection",
    exact: true,
  });
  const annualBox = (await annual.boundingBox())!;
  const chartCardBox = (await chart.locator("..").boundingBox())!;
  expect(
    annualBox.y - (chartCardBox.y + chartCardBox.height),
  ).toBeGreaterThanOrEqual(20);
  expect(
    annualBox.y - (chartCardBox.y + chartCardBox.height),
  ).toBeLessThanOrEqual(28);
  if (desktop) {
    const inputBox = (await page.locator("aside").boundingBox())!;
    expect(annualBox.x).toBeGreaterThan(inputBox.x + inputBox.width);
    expect(annualBox.y).toBeLessThan(inputBox.y + inputBox.height);
    const scrollRegion = page.getByRole("region", {
      name: "Scrollable annual projection table",
    });
    await scrollRegion.focus();
    await expect(scrollRegion).toBeFocused();
    const overflow = await scrollRegion.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    );
    if (overflow) {
      await scrollRegion.press("ArrowRight");
      await expect
        .poll(() => scrollRegion.evaluate((element) => element.scrollLeft))
        .toBeGreaterThan(0);
      await scrollRegion.evaluate((element) => {
        element.scrollLeft = 0;
      });
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    page.viewportSize()!.width,
  );
  await page.mouse.move(0, 0);
  const imagePath = testInfo.outputPath("paginated-results.png");
  await page
    .getByRole("region", { name: "Projection results", exact: true })
    .screenshot({ path: imagePath });
  await testInfo.attach("Chart and paginated results", {
    path: imagePath,
    contentType: "image/png",
  });
});
