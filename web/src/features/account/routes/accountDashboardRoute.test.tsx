import { describe, expect, it } from "vitest";
import { AccountDashboardPage } from "../pages/AccountDashboardPage/AccountDashboardPage";
import { Component } from "./accountDashboardRoute";

describe("account dashboard route", () => {
  it("renders the account dashboard", () => {
    expect(Component).toBe(AccountDashboardPage);
  });
});
