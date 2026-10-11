import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
vi.mock("@/hooks/useShapeData", () => ({
  useShapeData: () => ({ shapes: [], loading: true, errors: [] }),
}));
vi.mock("@/components/absorber/FindBestTab", () => ({ default: () => null }));
vi.mock("@/components/absorber/InverseDesignTab", () => ({
  default: () => null,
}));
vi.mock("@/components/absorber/BioSensingTab", () => ({
  default: () => <p>Analytical module ready</p>,
}));
vi.mock("@/components/absorber/ChatTab", () => ({
  default: () => <p>Chat module ready</p>,
}));
vi.mock("@/components/absorber/ExportTab", () => ({ default: () => null }));
import Index from "./Index";
it("presents both concepts with honest provenance and no dependency on CST loading", () => {
  render(<Index />);
  expect(screen.getByText("Nitrate sensing concept")).toBeTruthy();
  expect(
    screen.getAllByRole("img", { name: /not a verified hardware design/ }),
  ).toHaveLength(2);
  expect(
    screen.getByText(/Fabrication status is project-owner reported/),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: /DNN/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Analytical sensing" }));
  expect(screen.getByText("Analytical module ready")).toBeTruthy();
  expect(screen.getByText(/εr∈\{1,60,68\}/)).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "AI research assistant" }),
  );
  expect(screen.getByText("Chat module ready")).toBeTruthy();
});
it("keeps synthetic data opt-in and provides an accessible settings toggle", () => {
  render(<Index />);
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(
    screen.getByLabelText("Include SYNTHETIC / DEMONSTRATION DATA in searches"),
  ).toBeTruthy();
});
