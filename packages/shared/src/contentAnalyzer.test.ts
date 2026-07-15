import { describe, expect, it } from "vitest";

import { categorize } from "./contentAnalyzer.ts";

describe("categorize phone detection", () => {
  it("accepts common phone formats", () => {
    expect(categorize("+1 (234) 567-8901")).toBe("phone");
    expect(categorize("+44 20 7946 0958")).toBe("phone");
    expect(categorize("020-7946-0958")).toBe("phone");
  });

  it("rejects unbalanced parentheses", () => {
    expect(categorize("+1 (234 567-8901")).not.toBe("phone");
    expect(categorize("+1 234) 567-8901")).not.toBe("phone");
  });

  it("leaves ordinary text alone", () => {
    expect(categorize("hello world")).toBe("text");
  });
});
