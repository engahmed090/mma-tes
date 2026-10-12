import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  reset: vi.fn(),
  sample: vi.fn(),
  play: vi.fn(),
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
it("auto-loads main on mount, reuses enclosure/reset, switches and cleans up models", async () => {
  const { unmount } = render(<HardwareViewer />);
  expect(screen.queryByRole("button", { name: "Explore 3D" })).toBeNull();
  expect(screen.queryByText("Load the original R04 hardware asset")).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("Loading research hardware");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Reset" })).toBeEnabled(),
  );
  expect(fake.create.mock.calls[0][5]).toBe(false);
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.click(screen.getByLabelText("Open enclosure"));
  expect(fake.open).toHaveBeenCalledWith(true);
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  expect(fake.reset).toHaveBeenCalledOnce();
  fireEvent.click(
    screen.getByRole("button", { name: "Portable nitrate sensor" }),
  );
  await waitFor(() => expect(fake.create).toHaveBeenCalledTimes(2));
  expect(fake.create.mock.calls[1][5]).toBe(true);
  expect(fake.dispose).toHaveBeenCalled();
  expect(screen.getByLabelText("Open enclosure")).toBeEnabled();
  expect(
    screen.getByText(/not measured results or diagnostic evidence/),
  ).toBeTruthy();
  unmount();
  expect(fake.dispose).toHaveBeenCalledTimes(2);
});
it("reports load failure without a substitute and permits retry", async () => {
  fake.create.mockRejectedValueOnce(new Error("download failed"));
  render(<HardwareViewer />);
  expect(await screen.findByRole("alert")).toHaveTextContent("3D unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Retry 3D" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Reset" })).toBeEnabled(),
  );
});

it("wires play, pause, samples and illustrative result states without scientific metrics", async () => {
  render(<HardwareViewer />);
  fireEvent.change(screen.getByLabelText("Research demonstration sample"), { target: { value: "Healthy" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Play Demo" })).toBeEnabled());
  expect(fake.sample).toHaveBeenCalledWith("Healthy");
  fireEvent.click(screen.getByRole("button", { name: "Play Demo" }));
  expect(fake.play).toHaveBeenCalledOnce();
  act(() => fake.create.mock.calls[0][3]({ time: 16, playing: true, stage: "Research result display", screen: "demo", cartridge: 0 }));
  expect(screen.getByTestId("demo-result")).toHaveTextContent("NORMAL-LIKE PATTERN");
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  expect(fake.play).toHaveBeenCalledTimes(2);
  fireEvent.change(screen.getByLabelText("Research demonstration sample"), { target: { value: "Research" } });
  expect(fake.sample).toHaveBeenLastCalledWith("Research");
  expect(screen.getByTestId("demo-result")).toHaveTextContent("Select sample and press Play Demo");
  fireEvent.click(screen.getByRole("button", { name: "Portable nitrate sensor" }));
  await waitFor(() => expect(fake.create).toHaveBeenCalledTimes(2));
  act(() => fake.create.mock.calls[1][3]({ time: 16, playing: true, stage: "Nitrate screening demonstration", screen: "demo", cartridge: 0 }));
  expect(screen.getByTestId("demo-result")).toHaveTextContent("WITHIN REFERENCE RANGE");
  expect(screen.getByLabelText("Research demonstration sample")).toHaveValue("JuiceReference");
  expect(screen.getByText("Concentration / calibrated reference range: Unavailable")).toBeTruthy();
});
