"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ModelsCatalogCard } from '@/components/admin/ModelsCatalogCard';
import { LocalModelsManager } from '@/components/admin/LocalModelsManager';
import { ModelAccessManager } from '@/components/admin/ModelAccessManager';

export function AdminModelsTabs() {
  return (
    <Tabs defaultValue="discover" className="w-full">
      <TabsList className="bg-white/[0.04] border border-white/10 h-auto p-1 rounded-xl">
        <TabsTrigger
          value="discover"
          className="text-xs data-[state=active]:bg-white data-[state=active]:text-black rounded-lg"
        >
          Discover Models
        </TabsTrigger>
      </TabsList>

      <TabsContent value="discover" className="mt-4">
        <div className="space-y-4">
          <ModelsCatalogCard />
          <ModelAccessManager />
          <LocalModelsManager />
        </div>
      </TabsContent>
    </Tabs>
  );
}
