import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatBotDocumental } from "./ChatBotDocumental";
import { chatbotService } from "@/services/chatbotService";

vi.mock("@/services/chatbotService", () => ({
  chatbotService: { ask: vi.fn() },
}));

describe("ChatBotDocumental", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("muestra las URL de las respuestas como enlaces seguros", async () => {
    vi.mocked(chatbotService.ask).mockResolvedValue({
      answer: "Consulta la guía: https://example.com/documentos. javascript:alert(1)",
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    render(<ChatBotDocumental />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir asistente documental" }));
    fireEvent.change(screen.getByPlaceholderText("Escribe tu consulta documental"), {
      target: { value: "¿Dónde está la guía?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));

    const link = await screen.findByRole("link", { name: "https://example.com/documentos" });
    expect(link).toHaveAttribute("href", "https://example.com/documentos");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link.closest("span")).toHaveTextContent(
      "Consulta la guía: https://example.com/documentos. javascript:alert(1)",
    );
  });
});
