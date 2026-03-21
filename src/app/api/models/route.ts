import { NextResponse } from 'next/server';

/**
 * Internal API route to list available models from NexusLLM.
 * Proxies the request to keep credentials secure.
 */
export async function GET() {
  const clientId = process.env.NEXUSLLM_CLIENT_ID;
  const clientSecret = process.env.NEXUSLLM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Server configuration error: Missing credentials' },
      { status: 500 }
    );
  }

  try {
    const targetUrl = `https://zentithllm.nishantapps.in/api/models?client_id=${clientId}&client_secret=${clientSecret}`;
    
    const response = await fetch(targetUrl, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to fetch models from NexusLLM' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('List Models Proxy Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
