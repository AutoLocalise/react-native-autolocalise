import React, { useState } from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import {
  TranslationProvider,
  useAutoTranslate,
} from "../TranslationContext";

const mockStorageAdapter = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

jest.mock("../../storage", () => ({
  getStorageAdapter: jest.fn(() => mockStorageAdapter),
}));

global.fetch = jest.fn();

const config = {
  apiKey: "test-api-key",
  sourceLocale: "en",
  targetLocale: "es",
};

function Probe() {
  const { t, loading } = useAutoTranslate();
  return React.createElement(
    "span",
    { "data-testid": "probe" },
    loading ? "loading" : t("Hello")
  );
}

describe("useAutoTranslate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockStorageAdapter.getItem as jest.Mock).mockResolvedValue(null);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      statusText: "OK",
      json: () => Promise.resolve({}),
    });
  });

  it("throws when used outside TranslationProvider", () => {
    expect(() => renderHook(() => useAutoTranslate())).toThrow(
      "useAutoTranslate must be used within a TranslationProvider"
    );
  });

  it("returns translate helper inside provider", async () => {
    const { getByTestId } = render(
      React.createElement(TranslationProvider, {
        config,
        children: React.createElement(Probe),
      })
    );

    await waitFor(() => {
      expect(getByTestId("probe").textContent).toBe("Hello");
    });
  });

  it("re-inits when target locale changes", async () => {
    function Harness() {
      const [targetLocale, setTargetLocale] = useState("es");
      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "button",
          { type: "button", onClick: () => setTargetLocale("fr") },
          "switch"
        ),
        React.createElement(TranslationProvider, {
          config: { ...config, targetLocale },
          children: React.createElement(Probe),
        })
      );
    }

    const { getByText } = render(React.createElement(Harness));

    await waitFor(() => {
      expect(mockStorageAdapter.getItem).toHaveBeenCalledWith(
        "autolocalise_es"
      );
    });

    fireEvent.click(getByText("switch"));

    await waitFor(() => {
      expect(mockStorageAdapter.getItem).toHaveBeenCalledWith(
        "autolocalise_fr"
      );
    });
  });
});
