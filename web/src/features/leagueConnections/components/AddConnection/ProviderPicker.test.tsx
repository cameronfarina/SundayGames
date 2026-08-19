import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { providerCatalogFixture } from "../../api/leagueConnections.fixture";
import { ProviderPicker } from "./ProviderPicker";

describe("ProviderPicker", () => {
  it("offers every provider and explains none until one is chosen", () => {
    render(<ProviderPicker
      onSelect={vi.fn()}
      providers={providerCatalogFixture}
      selected={undefined}
    />);

    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("reports the chosen provider back to the caller", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ProviderPicker
      onSelect={onSelect}
      providers={providerCatalogFixture}
      selected="sleeper"
    />);

    expect(screen.getByRole("tab", { name: "Sleeper" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("status")).toHaveTextContent(/just a username/u);
    await user.click(screen.getByRole("tab", { name: "ESPN" }));

    expect(onSelect).toHaveBeenCalledWith("espn");
  });

  it("warns rather than informs when a provider cannot be connected", () => {
    render(<ProviderPicker
      onSelect={vi.fn()}
      providers={providerCatalogFixture}
      selected="yahoo"
    />);

    expect(screen.getByRole("status")).toHaveTextContent(/reviews every Fantasy API application/u);
  });
});
