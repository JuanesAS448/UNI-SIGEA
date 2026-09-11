import { apiClient } from "@/lib/api";

export interface ChatbotResponse {
  answer: string;
}

export const chatbotService = {
  ask: (message: string): Promise<ChatbotResponse> =>
    apiClient.post<ChatbotResponse>("/chatbot/", { message }),
};
