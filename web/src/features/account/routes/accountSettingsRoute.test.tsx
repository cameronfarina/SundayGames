import { describe, expect, it } from "vitest";
import { Component } from "./accountSettingsRoute";
import { AccountSettingsPage } from "../pages/AccountSettingsPage/AccountSettingsPage";

describe("account settings route", () => {
  it("renders the account settings page", () => {
    expect(Component).toBe(AccountSettingsPage);
  });
});
