import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    const formData = await req.formData();
    const audio = formData.get('audio') as File | null;
    const locale = (formData.get('locale') as string) || 'id';

    if (!audio) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
    }

    const buffer = await audio.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = audio.type || 'audio/webm';

    const language = locale === 'en' ? 'English' : 'Indonesian (Bahasa Indonesia)';

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: `Transcribe this audio exactly as spoken. Return ONLY the transcription text, nothing else. No quotes, no labels, no explanation. The speaker is likely speaking in ${language}.` },
          ],
        },
      ],
    });

    const text = (response.text ?? '').trim();

    if (!text) {
      return NextResponse.json({ error: 'No speech detected' }, { status: 422 });
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  }
}
