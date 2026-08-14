import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { InvitationAuthActions } from "./InvitationAuthActions";

const LocationOutput = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
};

describe("InvitationAuthActions", () => {
  it("routes sign in through the application with an invitation return path", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/invite?token=secret"]}>
      <InvitationAuthActions token="secret" />
      <LocationOutput />
    </MemoryRouter>);

    const signIn = screen.getByRole("link", { name: "Sign in" });
    expect(signIn).toHaveAttribute("href", "/login?returnTo=%2Finvite%3Ftoken%3Dsecret");
    await user.click(signIn);
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/login?returnTo=%2Finvite%3Ftoken%3Dsecret",
    );
  });

  it("routes account creation through the application with an invitation return path", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/invite?token=secret"]}>
      <InvitationAuthActions token="secret" />
      <LocationOutput />
    </MemoryRouter>);

    const createAccount = screen.getByRole("link", { name: "Create account" });
    expect(createAccount).toHaveAttribute("href", "/signup?returnTo=%2Finvite%3Ftoken%3Dsecret");
    await user.click(createAccount);
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/signup?returnTo=%2Finvite%3Ftoken%3Dsecret",
    );
  });
});
