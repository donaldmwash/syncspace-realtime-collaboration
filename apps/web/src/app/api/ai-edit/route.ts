import { generateText } from "ai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: unknown };
    const documentText = body.text;

    if (typeof documentText !== "string" || documentText.length > 20_000) {
      return NextResponse.json(
        { error: "Provide document text under 20,000 characters." },
        { status: 400 },
      );
    }

    // AI Gateway authenticates Vercel deployments with the request-scoped
    // Vercel OIDC token. That token is not reliably exposed as process.env
    // inside a running Function, so let the AI SDK resolve authentication.
    const result = await generateText({
      model: "openai/gpt-5.4",
      system:
        "You are a collaborative document participant. Write a concise, useful summary of the document in 2–4 sentences. Return only the summary text.",
      prompt:
        documentText.trim() ||
        "The document is empty. Suggest a concise opening paragraph.",
    });

    const insertion = result.text.trim();
    if (!insertion) {
      return NextResponse.json(
        { error: "The AI returned an empty summary. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ insertion: "\n\n" + insertion });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown AI Gateway error";
    console.error(
      JSON.stringify({
        level: "error",
        event: "ai_edit_failed",
        message,
      }),
    );
    return NextResponse.json(
      { error: "AI edit failed. Please try again in a moment." },
      { status: 502 },
    );
  }
}
