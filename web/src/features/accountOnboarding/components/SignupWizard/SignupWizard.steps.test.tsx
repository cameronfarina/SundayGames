import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConnectionsStep } from "./ConnectionsStep";
import { IntentStep } from "./IntentStep";
import { ProvidersStep } from "./ProvidersStep";

describe("SignupWizard steps", () => {
  it("does not submit the intent step without a selection", () => {
    const onContinue = vi.fn();
    render(<IntentStep
      error={undefined}
      initialIntent={null}
      onContinue={onContinue}
      pending={false}
    />);

    fireEvent.submit(screen.getByRole("form", { name: "Draft setup intent" }));

    expect(onContinue).not.toHaveBeenCalled();
  });

  it("restores an intent and communicates its pending error state", () => {
    render(<IntentStep
      error="The answer could not be saved."
      initialIntent="live_draft"
      onContinue={vi.fn()}
      pending
    />);

    expect(screen.getByRole("radio", { name: /Host a live draft/u })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Host a live draft/u }))
      .toHaveAccessibleDescription("Run your league's real draft in Sunday Games.");
    expect(screen.getByRole("alert")).toHaveTextContent("The answer could not be saved.");
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
  });

  it("keeps no-league exclusive and supports deselecting every platform", async () => {
    const onContinue = vi.fn();
    const user = userEvent.setup();
    render(<ProvidersStep
      error={undefined}
      initialProviders={null}
      onBack={vi.fn()}
      onContinue={onContinue}
      pending={false}
    />);

    fireEvent.submit(screen.getByRole("form", { name: "League platforms" }));
    expect(onContinue).not.toHaveBeenCalled();
    await user.click(screen.getByRole("checkbox", { name: "I don't have a league yet" }));
    await user.click(screen.getByRole("checkbox", { name: "ESPN" }));
    expect(screen.getByRole("checkbox", { name: "I don't have a league yet" })).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "ESPN" }));
    expect(screen.getByRole("checkbox", { name: "ESPN" })).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "I don't have a league yet" }));
    await user.click(screen.getByRole("checkbox", { name: "I don't have a league yet" }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("restores provider answers and communicates their pending error state", () => {
    render(<ProvidersStep
      error="The platforms could not be saved."
      initialProviders={["sleeper"]}
      onBack={vi.fn()}
      onContinue={vi.fn()}
      pending
    />);

    expect(screen.getByRole("checkbox", { name: "Sleeper" })).toBeChecked();
    expect(screen.getByRole("alert")).toHaveTextContent("The platforms could not be saved.");
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });

  it("renders non-connectable choices and keeps finish optional", async () => {
    const onBack = vi.fn();
    const onFinish = vi.fn();
    const user = userEvent.setup();
    render(<ConnectionsStep
      error="Setup could not finish."
      onBack={onBack}
      onFinish={onFinish}
      pending={false}
      providers={["other", "none"]}
    />);

    expect(screen.getByRole("heading", { name: "Other" })).toBeVisible();
    expect(screen.getByText(/create one after setup or explore practice drafts/u)).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Setup could not finish.");
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Finish setup" }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("disables connection-step actions while finishing", () => {
    render(<ConnectionsStep
      error={undefined}
      onBack={vi.fn()}
      onFinish={vi.fn()}
      pending
      providers={[]}
    />);

    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Finishing..." })).toBeDisabled();
  });
});
