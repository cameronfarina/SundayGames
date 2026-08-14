import type { PropsWithChildren, ReactNode } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

export const renderLiveDraftWorkspace = (workspace: ReactNode) =>
  render(workspace, {
    wrapper: ({ children }: PropsWithChildren) => (
      <MemoryRouter initialEntries={["/draft-room?seasonId=season-1&roomId=room-1"]}>
        {children}
      </MemoryRouter>
    ),
  });
