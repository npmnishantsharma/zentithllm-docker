"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HuggingFaceModelDownloadCard } from '@/components/admin/HuggingFaceModelDownloadCard';
import { ModelsCatalogCard } from '@/components/admin/ModelsCatalogCard';

export function AdminModelsTabs() {
  return (
    <Tabs defaultValue="download" className="w-full">
      <TabsList className="bg-white/[0.04] border border-white/10 h-auto p-1 rounded-xl">
        <TabsTrigger
          value="download"
          className="text-xs data-[state=active]:bg-white data-[state=active]:text-black rounded-lg"
        >
          Download Model
        </TabsTrigger>
        <TabsTrigger
          value="discover"
          className="text-xs data-[state=active]:bg-white data-[state=active]:text-black rounded-lg"
        >
          Discover and Recommend
        </TabsTrigger>
      </TabsList>

      <TabsContent value="download" className="mt-4">
        <HuggingFaceModelDownloadCard />
      </TabsContent>

      <TabsContent value="discover" className="mt-4">
        <ModelsCatalogCard />
      </TabsContent>
    </Tabs>
  );
}
