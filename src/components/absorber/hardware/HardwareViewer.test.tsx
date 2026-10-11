import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  reset: vi.fn(),
  open: vi.fn(),
  dispose: vi.fn(),
  create: vi.fn(),
}));
vi.mock("./viewer", () => ({ createViewer: fake.create }));
import HardwareViewer from "./HardwareViewer";
beforeEach(() => {
  vi.clearAllMocks();
  fake.create.mockResolvedValue(fake);
});
it("loads only on request, reuses enclosure/reset, switches and cleans up models", async () => {
  const { unmount } = render(<HardwareViewer />);
  expect(fake.create).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Explore 3D" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Reset view" })).toBeEnabled(),
  );
  expect(fake.create.mock.calls[0][5]).toBe(false);
  fireEvent.click(screen.getByLabelText("Open enclosure"));
  expect(fake.open).toHaveBeenCalledWith(true);
  fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
  expect(fake.reset).toHaveBeenCalledOnce();
  fireEvent.click(
    screen.getByRole("button", { name: "Portable nitrate sensor" }),
  );
  await waitFor(() => expect(fake.create).toHaveBeenCalledTimes(2));
  expect(fake.create.mock.calls[1][5]).toBe(true);
  expect(fake.dispose).toHaveBeenCalled();
  expect(screen.queryByLabelText("Open enclosure")).toBeNull();
  expect(
    screen.getByText(/not measured results or diagnostic evidence/),
  ).toBeTruthy();
  unmount();
  expect(fake.dispose).toHaveBeenCalledTimes(2);
});
it("reports load failure without a substitute and permits retry", async () => {
  fake.create.mockRejectedValueOnce(new Error("download failed"));
  render(<HardwareViewer />);
  fireEvent.click(screen.getByRole("button", { name: "Explore 3D" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("3D unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Retry 3D" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Reset view" })).toBeEnabled(),
  );
});
