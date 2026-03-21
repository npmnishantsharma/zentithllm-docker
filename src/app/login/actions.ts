
'use server';

/**
 * Server Action to handle secure authentication with NexusLLM.
 * This keeps the client_id and client_secret on the server.
 */
export async function authenticateWithNexusLLM() {
  const clientId = process.env.NEXUSLLM_CLIENT_ID;
  const clientSecret = process.env.NEXUSLLM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing NexusLLM credentials in environment variables.');
  }

  try {
    const response = await fetch('https://zentithllm.nishantapps.in/api/auth/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Authentication failed');
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    console.error('NexusLLM Auth Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Finalizes the handshake by exchanging the one-time code for user profile info.
 */
export async function getUserInfoWithCode(code: string) {
  const clientId = process.env.NEXUSLLM_CLIENT_ID;
  const clientSecret = process.env.NEXUSLLM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing NexusLLM credentials in environment variables.');
  }

  try {
    const response = await fetch('https://zentithllm.nishantapps.in/api/auth/userinfo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Handshake failed at user info exchange');
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    console.error('NexusLLM UserInfo Error:', error.message);
    return { success: false, error: error.message };
  }
}
