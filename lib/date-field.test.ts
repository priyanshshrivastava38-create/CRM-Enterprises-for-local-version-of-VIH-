import { describe, expect, it } from "vitest";
import { formatFieldValue, monthGrid, parseFieldValue, quickPicks, timeLabel, toFieldValue } from "./date-field";

describe("date field values", () => {
  it("round-trips local date and datetime strings", () => {
    const date = new Date(2026, 9, 9, 14, 30);
    expect(toFieldValue(date, "date")).toBe("2026-10-09");
    expect(toFieldValue(date, "datetime")).toBe("2026-10-09T14:30");
    expect(parseFieldValue("2026-10-09T14:30")?.getHours()).toBe(14);
    expect(parseFieldValue("")).toBeNull();
    expect(parseFieldValue("not a date")).toBeNull();
  });

  it("formats readable labels", () => {
    expect(timeLabel(0, 0)).toBe("12:00 AM");
    expect(timeLabel(14, 30)).toBe("2:30 PM");
    expect(formatFieldValue("2026-10-09T10:00", "datetime")).toContain("10:00 AM");
    expect(formatFieldValue("2026-10-09", "date")).toBe("Fri, 9 Oct 2026");
    expect(formatFieldValue("", "date")).toBe("");
  });
});

describe("quickPicks", () => {
  it("offers a same-day slot only before 4 PM and lands next Monday on a Monday", () => {
    const wednesdayMorning = new Date(2026, 9, 7, 9, 0);
    const picks = quickPicks("datetime", wednesdayMorning);
    expect(picks[0]).toEqual({ label: "Today, 5 PM", value: "2026-10-07T17:00" });
    expect(picks.find((pick) => pick.label === "Next Monday")?.value).toBe("2026-10-12T10:00");
    expect(quickPicks("datetime", new Date(2026, 9, 7, 18, 0)).some((pick) => pick.label === "Today, 5 PM")).toBe(false);
  });
});

describe("monthGrid", () => {
  it("pads to a Monday start", () => {
    const grid = monthGrid(2026, 9); // October 2026 starts on a Thursday
    expect(grid.slice(0, 3)).toEqual([null, null, null]);
    expect(grid[3]?.getDate()).toBe(1);
    expect(grid.filter(Boolean)).toHaveLength(31);
  });
});
