import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EspnAccountOptions } from "./EspnAccountOptions";

describe("EspnAccountOptions", () => {
  it("submits both cookies for account-wide discovery without a league ID", async () => {
    const onCredentials = vi.fn();
    const user = userEvent.setup();
    render(<EspnAccountOptions
      disabled={false}
      espnMobileDeferred={false}
      espnS2="session"
      headingLevel={3}
      onBusyChange={vi.fn()}
      onCredentials={onCredentials}
      onEspnMobile={undefined}
      onEspnS2Change={vi.fn()}
      onSwidChange={vi.fn()}
      swid="{ACCOUNT}"
    />);

    expect(screen.getByText(/No league ID is required/u)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Find my ESPN leagues" }));

    expect(onCredentials).toHaveBeenCalledWith();
  });
});
