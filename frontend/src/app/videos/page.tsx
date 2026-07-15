"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useVideos } from "@/hooks/useVideos";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Video, Loader2, AlertCircle, Trash2, Search, Upload, Film } from "lucide-react";

const statusFilters = [
  { value: "all", label: "All" },
  { value: "ready", label: "Ready" },
  { value: "processing", label: "Processing" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
];

export default function VideosPage() {
  const { videos, total, isLoading, error, fetchVideos, deleteVideo } = useVideos();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchVideos({ limit: 50 });
  }, [fetchVideos]);

  const filteredVideos = videos
    .filter((v) => filter === "all" || v.status === filter)
    .filter(
      (v) =>
        !search ||
        v.title?.toLowerCase().includes(search.toLowerCase())
    );

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Delete this video and all its clips?")) {
      await deleteVideo(id);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">My Videos</h1>
          <p className="text-zinc-400 mt-1">
            {total} video{total !== 1 ? "s" : ""} in your library
          </p>
        </div>
        <Button asChild>
          <Link href="/upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload Video
          </Link>
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search videos..."
            className="pl-10"
          />
        </div>
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            {statusFilters.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </Card>
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center justify-center gap-3 py-24 text-zinc-500">
          <AlertCircle className="h-6 w-6 text-red-400" />
          <span>{error}</span>
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="text-center py-24 rounded-2xl border border-zinc-700/50 bg-zinc-800/30">
          <div className="p-4 rounded-2xl bg-zinc-800/50 ring-1 ring-zinc-700/50 w-fit mx-auto mb-6">
            <Film className="h-12 w-12 text-zinc-600" />
          </div>
          <h3 className="text-xl font-medium text-zinc-400 mb-2">
            {search || filter !== "all" ? "No matching videos" : "No videos yet"}
          </h3>
          <p className="text-sm text-zinc-500 mb-6 max-w-sm mx-auto">
            {search || filter !== "all"
              ? "Try a different search or filter"
              : "Upload your first video to start generating AI-powered highlights"}
          </p>
          {!search && filter === "all" && (
            <Button asChild>
              <Link href="/upload">
                <Upload className="h-4 w-4 mr-2" />
                Upload Video
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredVideos.map((video) => (
            <Link
              key={video.id}
              href={`/videos/${video.id}`}
              className="group rounded-xl border border-zinc-700/50 bg-zinc-800/50 overflow-hidden hover:border-zinc-600/50 hover:bg-zinc-800/80 transition-all duration-300 hover:-translate-y-0.5"
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-zinc-700 relative overflow-hidden">
                {video.thumbnail ? (
                  <img
                    src={video.thumbnail}
                    alt={video.title || "Video"}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Video className="h-12 w-12 text-zinc-600" />
                  </div>
                )}

                {/* Status badge */}
                <div className="absolute top-2 right-2">
                  <Badge
                    variant={
                      video.status === "ready" ? "success" :
                      video.status === "processing" ? "warning" :
                      video.status === "failed" ? "destructive" : "secondary"
                    }
                    className="text-[10px] px-1.5 py-0"
                  >
                    {video.status}
                  </Badge>
                </div>

                {/* Duration */}
                {video.duration && (
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-xs text-zinc-300 backdrop-blur-sm">
                    {Math.floor(video.duration / 60)}:
                    {(video.duration % 60).toString().padStart(2, "0")}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-medium text-white truncate group-hover:text-violet-300 transition-colors">
                  {video.title || "Untitled Video"}
                </h3>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-zinc-500">
                    {new Date(video.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <button
                    onClick={(e) => handleDelete(video.id, e)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete video"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
