
import { NextRequest } from 'next/server';

/**
 * Proxy route for the NexusLLM EventSource stream.
 * This keeps the client_id and client_secret secure on the server.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  
  const clientId = process.env.NEXUSLLM_CLIENT_ID;
  const clientSecret = process.env.NEXUSLLM_CLIENT_SECRET;

  if (!sessionId) {
    return new Response('Missing sessionId', { status: 400 });
  }

  if (!clientId || !clientSecret) {
    return new Response('Server configuration error: Missing credentials', { status: 500 });
  }

  const targetUrl = `https://zentithllm.nishantapps.in/api/auth/stream/${sessionId}?client_id=${clientId}&client_secret=${clientSecret}`;

  try {
    const response = await fetch(targetUrl, {
      cache: 'no-store',
      headers: {
        'Accept': 'text/event-stream',
      },
    });

    if (!response.ok || !response.body) {
      return new Response('Failed to connect to auth stream', { status: response.status });
    }

    // Pipe the remote stream directly to the client
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Proxy Stream Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
