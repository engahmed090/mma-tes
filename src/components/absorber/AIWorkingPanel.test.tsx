import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";
import AIWorkingPanel, { useAIStages } from "./AIWorkingPanel";
it("shows request facts without decorative neural networks or a fabricated success status", () => {
  render(
    <AIWorkingPanel
      stage="complete"
      inputs={[{ label: "Source", value: "CST" }]}
      outputs={[{ label: "Status", value: "Error" }]}
    />,
  );
  expect(screen.queryByText(/nodes|confidence|Complete/)).toBeNull();
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByText("Status: Error")).toBeTruthy();
});
it("executes computation without an artificial animation delay", async () => {
  const fn = vi.fn(() => 42);
  const { result, unmount } = renderHook(() => useAIStages());
  await act(async () => {
    expect(await result.current.runWithStages(fn)).toBe(42);
  });
  expect(fn).toHaveBeenCalledOnce();
  expect(result.current.stage).toBe("complete");
  unmount();
});
