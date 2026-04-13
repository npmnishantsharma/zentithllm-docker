import { NextRequest, NextResponse } from 'next/server';
import os from 'os';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const execFileAsync = promisify(execFile);

type GgufFile = {
  name: string;
  sizeBytes: number | null;
  sizeGB: number | null;
  downloadUrl: string;
};

type ModelSummary = {
  id: string;
  author?: string;
  downloads?: number;
  likes?: number;
  lastModified?: string;
  ggufFiles: GgufFile[];
};

type MachineSpecs = {
  platform: string;
  arch: string;
  cpuCores: number;
  totalMemoryBytes: number;
  totalMemoryGB: number;
  gpuName?: string;
  gpuMemoryBytes?: number;
  gpuMemoryGB?: number;
};

async function getMachineSpecs(): Promise<MachineSpecs> {
  const totalMemoryBytes = os.totalmem();
  const specs: MachineSpecs = {
    platform: os.platform(),
    arch: os.arch(),
    cpuCores: os.cpus().length,
    totalMemoryBytes,
    totalMemoryGB: Number((totalMemoryBytes / 1024 / 1024 / 1024).toFixed(1)),
  };

  try {
    const { stdout } = await execFileAsync('nvidia-smi', [
      '--query-gpu=name,memory.total',
      '--format=csv,noheader,nounits',
    ]);

    const first = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)[0];

    if (first) {
      const [name, memoryMiBRaw] = first.split(',').map((part) => part.trim());
      const memoryMiB = Number(memoryMiBRaw);
      if (name) specs.gpuName = name;

      if (Number.isFinite(memoryMiB) && memoryMiB > 0) {
        const gpuMemoryBytes = Math.round(memoryMiB * 1024 * 1024);
        specs.gpuMemoryBytes = gpuMemoryBytes;
        specs.gpuMemoryGB = Number((gpuMemoryBytes / 1024 / 1024 / 1024).toFixed(1));
      }
    }
  } catch {
  }

  return specs;
}

function toGB(sizeBytes: number | null): number | null {
  if (!sizeBytes || sizeBytes <= 0) return null;
  return Number((sizeBytes / 1024 / 1024 / 1024).toFixed(2));
}

function buildDownloadUrl(modelId: string, fileName: string): string {
  return `https://huggingface.co/${modelId}/resolve/main/${fileName
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

function getRecommendedModel(models: ModelSummary[], specs: MachineSpecs) {
  const allFiles = models
    .flatMap((model) =>
      model.ggufFiles.map((file) => ({
        modelId: model.id,
        modelDownloads: model.downloads || 0,
        file,
      }))
    )
    .filter((entry) => (entry.file.sizeBytes || 0) > 0);

  if (allFiles.length === 0) {
    return null;
  }

  const totalMemUsable = specs.totalMemoryBytes * 0.6;
  const gpuMemUsable = specs.gpuMemoryBytes ? specs.gpuMemoryBytes * 0.85 : 0;
  const usableMemory = Math.max(totalMemUsable, gpuMemUsable);
  const targetSize = usableMemory * 0.75;

  const fitting = allFiles
    .filter((entry) => (entry.file.sizeBytes || 0) <= targetSize)
    .sort((a, b) => {
      const sizeDiff = (b.file.sizeBytes || 0) - (a.file.sizeBytes || 0);
      if (sizeDiff !== 0) return sizeDiff;
      return (b.modelDownloads || 0) - (a.modelDownloads || 0);
    });

  const candidate =
    fitting[0] || allFiles.sort((a, b) => (a.file.sizeBytes || 0) - (b.file.sizeBytes || 0))[0];

  const sizeBytes = candidate.file.sizeBytes || 0;
  const fitRatio = usableMemory > 0 ? sizeBytes / usableMemory : 999;
  const fit = fitRatio <= 0.55 ? 'excellent' : fitRatio <= 0.75 ? 'good' : fitRatio <= 1 ? 'tight' : 'too-large';

  return {
    modelId: candidate.modelId,
    fileName: candidate.file.name,
    downloadUrl: candidate.file.downloadUrl,
    sizeBytes,
    sizeGB: toGB(sizeBytes),
    fit,
    reason:
      fit === 'too-large'
        ? 'Smallest available GGUF is larger than the recommended memory budget for this machine.'
        : 'Largest GGUF file that fits your machine memory budget with headroom.',
  };
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = (searchParams.get('q') || 'gguf').trim();
  const requestedLimit = Number(searchParams.get('limit') || '80');
  const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 80, 1), 200);

  const machineSpecs = await getMachineSpecs();

  try {
    const listUrl = `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&sort=downloads&direction=-1&limit=${limit}`;
    const listResponse = await fetch(listUrl, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!listResponse.ok) {
      const details = await listResponse.text().catch(() => 'Failed to fetch models');
      return NextResponse.json(
        { error: `Hugging Face model list failed (${listResponse.status}): ${details.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const rawModels = (await listResponse.json().catch(() => [])) as Array<{ id?: string }>;
    const modelIds = rawModels.map((model) => model.id).filter((id): id is string => !!id);

    const ggufModels: ModelSummary[] = [];
    const batchSize = 8;

    for (let i = 0; i < modelIds.length; i += batchSize) {
      const batch = modelIds.slice(i, i + batchSize);
      const details = await Promise.all(
        batch.map(async (modelId) => {
          try {
            const response = await fetch(`https://huggingface.co/api/models/${encodeURIComponent(modelId)}`, {
              cache: 'no-store',
              headers: { Accept: 'application/json' },
            });

            if (!response.ok) return null;

            const data = await response.json();
            const siblings = Array.isArray(data?.siblings) ? data.siblings : [];
            const ggufFiles: GgufFile[] = siblings
              .filter(
                (file: any) => typeof file?.rfilename === 'string' && file.rfilename.toLowerCase().endsWith('.gguf')
              )
              .map((file: any) => {
                const sizeBytes = Number.isFinite(file?.size)
                  ? Number(file.size)
                  : Number.isFinite(file?.lfs?.size)
                    ? Number(file.lfs.size)
                    : null;

                return {
                  name: file.rfilename,
                  sizeBytes,
                  sizeGB: toGB(sizeBytes),
                  downloadUrl: buildDownloadUrl(modelId, file.rfilename),
                };
              });

            if (ggufFiles.length === 0) return null;

            return {
              id: modelId,
              author: data?.author,
              downloads: data?.downloads,
              likes: data?.likes,
              lastModified: data?.lastModified,
              ggufFiles,
            } as ModelSummary;
          } catch {
            return null;
          }
        })
      );

      ggufModels.push(...details.filter((item): item is ModelSummary => !!item));
    }

    const recommendation = getRecommendedModel(ggufModels, machineSpecs);

    return NextResponse.json({
      success: true,
      query,
      searched: modelIds.length,
      modelsFound: ggufModels.length,
      machineSpecs,
      recommendation,
      models: ggufModels,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch GGUF models' }, { status: 500 });
  }
}
