import React from "react";
import Page from "./Page";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { mockCma, mockSdk } from "../../test/mocks";
import { vi } from "vitest";

vi.mock("@contentful/react-apps-toolkit", () => ({
  useSDK: () => mockSdk,
  useCMA: () => mockCma,
}));

describe("Page component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSdk.ids = {
      app: "test-app",
      space: "test-space",
      environment: "test-environment",
    };
    mockSdk.cma = mockCma;
    mockCma.contentType = {
      get: vi.fn().mockResolvedValue({
        sys: { id: "cta" },
        name: "CTA",
        displayField: "title",
      }),
      getMany: vi.fn(),
    };
    mockCma.entry = {
      getMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    };
  });

  it("scans only CTA entries", async () => {
    render(<Page />);

    fireEvent.click(
      screen.getByRole("button", { name: "Scan for Duplicates" }),
    );

    await waitFor(() => {
      expect(mockCma.entry.getMany).toHaveBeenCalledWith({
        spaceId: "test-space",
        environmentId: "test-environment",
        query: {
          content_type: "cta",
          skip: 0,
          limit: 1000,
          "sys.archivedAt[exists]": false,
        },
      });
    });

    expect(mockCma.contentType.get).toHaveBeenCalledWith({
      spaceId: "test-space",
      environmentId: "test-environment",
      contentTypeId: "cta",
    });
    expect(mockCma.contentType.getMany).not.toHaveBeenCalled();
    expect(
      await screen.findByText("No duplicate CTA entries found!"),
    ).toBeInTheDocument();
  });
});
