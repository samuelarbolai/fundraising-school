import { NextResponse } from "next/server";
import { friendlyVcSystemPrompt } from "./prompt";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = process.env.OPENAI_FRIENDLY_VC_MODEL || "gpt-4o-mini";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    const messages = body?.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Missing messages payload." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server misconfigured. OPENAI_API_KEY is not set." },
        { status: 500 }
      );
    }

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content: friendlyVcSystemPrompt,
          },
          ...messages.map(message => ({
            role: message.role,
            content: message.content,
          })),
        ],
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      const message =
        error?.error?.message ||
        error?.message ||
        (typeof error === "string" ? error : "") ||
        `OpenAI API error (${response.status}).`;
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return NextResponse.json({ error: "OpenAI returned an empty response." }, { status: 502 });
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[Friendly VC] Unexpected error", error);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
