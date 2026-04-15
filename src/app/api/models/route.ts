import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import path from 'path';

/**
 * Internal API route to list available models from NexusLLM.
 * Proxies the request to keep credentials secure.
 */
export async function GET() {
  const clientId = process.env.NEXUSLLM_CLIENT_ID;
  const clientSecret = process.env.NEXUSLLM_CLIENT_SECRET;

  const loadLocalModels = async () => {
    const modelsDir = path.join(process.cwd(), 'models');
    const entries = await readdir(modelsDir, { withFileTypes: true }).catch(() => []);

    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.gguf'))
      .map((entry) => ({
        id: `local:${entry.name}`,
        name: entry.name,
        provider: 'local',
        description: 'Local GGUF model',
      }));
  };

  if (!clientId || !clientSecret) {
    const localModels = await loadLocalModels();
    return NextResponse.json({
      success: true,
      models: localModels,
      warning: 'NexusLLM credentials missing. Showing local models only.',
    });
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
      const localModels = await loadLocalModels();
      return NextResponse.json({
        success: true,
        models: localModels,
        warning: errorData.message || 'Failed to fetch models from NexusLLM. Showing local models only.',
      });
    }

    const data = await response.json();
    const remoteModels = Array.isArray(data?.models)
      ? data.models.map((m: any) => ({
          id: m?.id,
          name: m?.name,
          provider: m?.provider,
          description: m?.description,
        }))
      : [];

    const localModels = await loadLocalModels();
    const allModels = [...localModels, ...remoteModels];
    const dedupedModels = allModels.filter((model, index, list) => {
      return list.findIndex((other) => other.id === model.id) === index;
    });

    return NextResponse.json({
      success: true,
      models: dedupedModels,
    });
  } catch (error: any) {
    console.error('List Models Proxy Error:', error);
    const localModels = await loadLocalModels();
    return NextResponse.json({
      success: true,
      models: localModels,
      warning: 'Internal error while fetching remote models. Showing local models only.',
    });
  }
}
