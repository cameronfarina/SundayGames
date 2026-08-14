import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createAppQueryClient } from "../../query/createAppQueryClient";
import { AppProviders } from "./AppProviders";

describe("AppProviders", () => {
  it("provides the caller-owned query client", () => {
    const queryClient = createAppQueryClient();

    render(
      <AppProviders queryClient={queryClient}>
        <p>Connected</p>
      </AppProviders>,
    );

    expect(screen.getByText("Connected")).toBeVisible();
  });
});
