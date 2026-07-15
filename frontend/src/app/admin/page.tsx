"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  Server,
  Users,
  HardDrive,
  BarChart3,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Film,
  Video,
  Activity,
  TrendingUp,
  ArrowUpRight,
  Search,
  ChevronDown,
  ChevronUp,
  FolderOpen,
} from "lucide-react";

interface AdminJob extends Record<string, unknown> {
  id: string;
  video_id: string;
  type: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  created_at: string;
  user_email?: string;
  video_title?: string;
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: "user" | "admin";
  created_at: string;
  videos_count?: number;
  clips_count?: number;
}

interface StorageData {
  uploads_size: number;
  generated_clips_size: number;
  total_size: number;
  free_space: number;
  total_space: number;
  uploads_path: string;
  generated_clips_path: string;
}

interface AnalyticsData {
  total_videos: number;
  total_clips: number;
  total_users: number;
  avg_processing_time: number;
  videos_today: number;
  clips_today: number;
  videos_this_week: number;
  clips_this_week: number;
  top_video: { id: string; title: string; clips_count: number } | null;
  processing_breakdown: Record<string, { avg_time: number; total: number }>;
}

type AdminTab = "jobs" | "users" | "storage" | "analytics";

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("analytics");

  // Data states
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [storage, setStorage] = useState<StorageData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [userSearch, setUserSearch] = useState("");
  const [jobExpanded, setJobExpanded] = useState<string | null>(null);

  // Check admin access
  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/dashboard");
    }
  }, [user, router]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [jobsRes, usersRes, storageRes, analyticsRes] = await Promise.allSettled([
        adminApi.listJobs(),
        adminApi.listUsers(),
        adminApi.getStorage(),
        adminApi.getAnalytics(),
      ]);

      if (jobsRes.status === "fulfilled") setJobs(jobsRes.value.data.data?.jobs || []);
      if (usersRes.status === "fulfilled") setUsers(usersRes.value.data.data?.users || []);
      if (storageRes.status === "fulfilled") setStorage(storageRes.value.data.data);
      if (analyticsRes.status === "fulfilled") setAnalytics(analyticsRes.value.data.data);

      if (jobsRes.status === "rejected" && usersRes.status === "rejected") {
        setError("Failed to load admin data.");
      }
    } catch {
      setError("Failed to load admin data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${s}s`;
  };

  const getJobStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="h-4 w-4 text-emerald-400" />;
      case "processing": return <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />;
      case "failed": return <XCircle className="h-4 w-4 text-red-400" />;
      default: return <Clock className="h-4 w-4 text-zinc-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
      completed: "success",
      processing: "warning",
      pending: "secondary",
      failed: "destructive",
    };
    return (
      <Badge variant={variants[status] || "secondary"} className="text-[10px]">
        {status}
      </Badge>
    );
  };

  const filteredJobs = jobs.filter((j) => jobFilter === "all" || j.status === jobFilter);
  const filteredUsers = users.filter(
    (u) =>
      !userSearch ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.name?.toLowerCase().includes(userSearch.toLowerCase())
  );

  // ─── Not admin? Don't render ───
  if (user && user.role !== "admin") {
    return null; // Will redirect via useEffect
  }

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/25">
          <Shield className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
          <p className="text-zinc-400 mt-1">System management and monitoring</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">&times;</button>
        </div>
      )}

      {/* Quick Stats */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover:border-zinc-600/50 transition">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500 font-medium">Total Videos</span>
                <div className="p-1.5 rounded-lg bg-violet-500/10">
                  <Video className="h-3.5 w-3.5 text-violet-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{analytics.total_videos}</p>
              <p className="text-[10px] text-zinc-600 mt-1">
                {analytics.videos_today} today &bull; {analytics.videos_this_week} this week
              </p>
            </CardContent>
          </Card>
          <Card className="hover:border-zinc-600/50 transition">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500 font-medium">Total Clips</span>
                <div className="p-1.5 rounded-lg bg-emerald-500/10">
                  <Film className="h-3.5 w-3.5 text-emerald-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{analytics.total_clips}</p>
              <p className="text-[10px] text-zinc-600 mt-1">
                {analytics.clips_today} today &bull; {analytics.clips_this_week} this week
              </p>
            </CardContent>
          </Card>
          <Card className="hover:border-zinc-600/50 transition">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500 font-medium">Users</span>
                <div className="p-1.5 rounded-lg bg-amber-500/10">
                  <Users className="h-3.5 w-3.5 text-amber-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{analytics.total_users}</p>
              <p className="text-[10px] text-zinc-600 mt-1">Registered accounts</p>
            </CardContent>
          </Card>
          <Card className="hover:border-zinc-600/50 transition">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500 font-medium">Avg. Processing</span>
                <div className="p-1.5 rounded-lg bg-fuchsia-500/10">
                  <Activity className="h-3.5 w-3.5 text-fuchsia-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{formatTime(analytics.avg_processing_time)}</p>
              <p className="text-[10px] text-zinc-600 mt-1">Per video</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AdminTab)}>
        <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="jobs" className="gap-2">
            <Server className="h-4 w-4" />
            <span className="hidden sm:inline">Jobs</span>
            {jobs.length > 0 && (
              <Badge variant="warning" className="text-[10px] ml-1">{jobs.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
          <TabsTrigger value="storage" className="gap-2">
            <HardDrive className="h-4 w-4" />
            <span className="hidden sm:inline">Storage</span>
          </TabsTrigger>
        </TabsList>

        {/* ─── Analytics Tab ─── */}
        <TabsContent value="analytics" className="mt-6 space-y-6">
          {analytics ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Processing Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white text-base">
                      <Activity className="h-4 w-4 text-violet-400" />
                      Processing Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(analytics.processing_breakdown).map(([stage, data]) => (
                      <div key={stage} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-zinc-300 capitalize">{stage}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">{data.total} jobs</span>
                            <Badge variant="outline" className="text-[10px]">
                              {formatTime(data.avg_time)} avg
                            </Badge>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-700/50 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                            style={{
                              width: `${(data.total / Math.max(...Object.values(analytics.processing_breakdown).map((d) => d.total))) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Top Video */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white text-base">
                      <TrendingUp className="h-4 w-4 text-emerald-400" />
                      Top Performing Video
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics.top_video ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50">
                          <div className="p-2 rounded-lg bg-emerald-500/20">
                            <Film className="h-5 w-5 text-emerald-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {analytics.top_video.title}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {analytics.top_video.clips_count} clips generated
                            </p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <a href={`/videos/${analytics.top_video.id}`}>
                              <ArrowUpRight className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">No data available</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/50 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{analytics.videos_today}</p>
                  <p className="text-xs text-zinc-500 mt-1">Videos Today</p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/50 text-center">
                  <p className="text-2xl font-bold text-violet-400">{analytics.clips_today}</p>
                  <p className="text-xs text-zinc-500 mt-1">Clips Today</p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/50 text-center">
                  <p className="text-2xl font-bold text-amber-400">{analytics.videos_this_week}</p>
                  <p className="text-xs text-zinc-500 mt-1">Videos This Week</p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/50 text-center">
                  <p className="text-2xl font-bold text-fuchsia-400">{analytics.clips_this_week}</p>
                  <p className="text-xs text-zinc-500 mt-1">Clips This Week</p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-zinc-500">No analytics data available.</div>
          )}
        </TabsContent>

        {/* ─── Jobs Tab ─── */}
        <TabsContent value="jobs" className="mt-6 space-y-4">
          {/* Job filters */}
          <div className="flex flex-wrap gap-2">
            {["all", "completed", "processing", "pending", "failed"].map((f) => (
              <Button
                key={f}
                variant={jobFilter === f ? "default" : "outline"}
                size="sm"
                onClick={() => setJobFilter(f)}
                className="text-xs h-8"
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== "all" && (
                  <span className="ml-1 text-[10px] opacity-70">
                    ({jobs.filter((j) => j.status === f).length})
                  </span>
                )}
              </Button>
            ))}
          </div>

          {/* Jobs table */}
          {filteredJobs.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-zinc-700/50 bg-zinc-800/30">
              <Server className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm">No jobs found matching this filter.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredJobs.map((job) => (
                <Card
                  key={job.id}
                  className={`hover:border-zinc-600/50 transition cursor-pointer ${
                    job.status === "failed" ? "border-red-500/30 bg-red-500/[0.02]" : ""
                  }`}
                  onClick={() => setJobExpanded(jobExpanded === job.id ? null : job.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">{getJobStatusIcon(job.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white capitalize">
                            {job.type.replace(/_/g, " ")}
                          </span>
                          {getStatusBadge(job.status)}
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Video: {job.video_title || job.video_id?.slice(0, 12) + "..." || "Unknown"}
                          {job.user_email && ` • ${job.user_email}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {(job.status === "processing" || job.status === "pending") && (
                          <>
                            <Progress value={job.progress} className="w-20 h-1.5" />
                            <span className="text-xs text-zinc-500 w-8 text-right">{job.progress}%</span>
                          </>
                        )}
                        {jobExpanded === job.id ? (
                          <ChevronUp className="h-4 w-4 text-zinc-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-zinc-500" />
                        )}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {jobExpanded === job.id && (
                      <div className="mt-4 pt-3 border-t border-zinc-700/50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-zinc-500">Job ID</span>
                          <p className="text-zinc-300 font-mono mt-0.5">{job.id.slice(0, 16)}...</p>
                        </div>
                        <div>
                          <span className="text-zinc-500">Video ID</span>
                          <p className="text-zinc-300 font-mono mt-0.5">{job.video_id?.slice(0, 16)}...</p>
                        </div>
                        <div>
                          <span className="text-zinc-500">Progress</span>
                          <p className="text-zinc-300 mt-0.5">{job.progress}%</p>
                        </div>
                        <div>
                          <span className="text-zinc-500">Created</span>
                          <p className="text-zinc-300 mt-0.5">
                            {new Date(job.created_at).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Jobs summary */}
          {jobs.length > 0 && (
            <div className="flex items-center justify-center gap-4 text-xs text-zinc-600 pt-2">
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-emerald-500" />
                {jobs.filter((j) => j.status === "completed").length} completed
              </span>
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 text-amber-400" />
                {jobs.filter((j) => j.status === "processing").length} processing
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-400" />
                {jobs.filter((j) => j.status === "failed").length} failed
              </span>
            </div>
          )}
        </TabsContent>

        {/* ─── Users Tab ─── */}
        <TabsContent value="users" className="mt-6 space-y-4">
          {/* Search */}
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-700/50 bg-zinc-800/50 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
            />
          </div>

          {filteredUsers.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-zinc-700/50 bg-zinc-800/30">
              <Users className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm">
                {userSearch ? "No users matching your search." : "No users registered yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((u) => (
                <Card key={u.id} className="hover:border-zinc-600/50 transition">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          u.role === "admin"
                            ? "bg-violet-500/20 text-violet-400 ring-2 ring-violet-500/30"
                            : "bg-zinc-700/50 text-zinc-400"
                        }`}
                      >
                        {(u.name || u.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white truncate">
                            {u.name || "Unnamed User"}
                          </span>
                          {u.role === "admin" && (
                            <Badge variant="info" className="text-[10px]">Admin</Badge>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{u.email}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-zinc-400">
                          Joined {new Date(u.created_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <p className="text-xs text-zinc-600 text-center">
            {users.length} total user{users.length !== 1 ? "s" : ""}
            &nbsp;&bull;&nbsp;
            {users.filter((u) => u.role === "admin").length} admin
          </p>
        </TabsContent>

        {/* ─── Storage Tab ─── */}
        <TabsContent value="storage" className="mt-6 space-y-6">
          {storage ? (
            <>
              {/* Main storage card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white text-base">
                    <HardDrive className="h-4 w-4 text-violet-400" />
                    Disk Usage
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Overall usage bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400">Total Used</span>
                      <span className="text-white font-medium">
                        {formatFileSize(storage.total_size)} / {formatFileSize(storage.total_space)}
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-zinc-700/50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500"
                        style={{ width: `${(storage.total_size / storage.total_space) * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-600">
                      <span>{((storage.total_size / storage.total_space) * 100).toFixed(1)}% used</span>
                      <span>{formatFileSize(storage.free_space)} free</span>
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-violet-500/10">
                          <FolderOpen className="h-5 w-5 text-violet-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">Uploads</p>
                          <p className="text-[10px] text-zinc-500 font-mono">{storage.uploads_path}</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-white">{formatFileSize(storage.uploads_size)}</p>
                      <div className="mt-2 h-1.5 rounded-full bg-zinc-700/50 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-violet-500"
                          style={{ width: `${(storage.uploads_size / storage.total_size) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                          <Film className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">Generated Clips</p>
                          <p className="text-[10px] text-zinc-500 font-mono">{storage.generated_clips_path}</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-white">{formatFileSize(storage.generated_clips_size)}</p>
                      <div className="mt-2 h-1.5 rounded-full bg-zinc-700/50 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${(storage.generated_clips_size / storage.total_size) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-12 text-zinc-500">No storage data available.</div>
          )}
        </TabsContent>
      </Tabs>

      {/* Refresh button */}
      <div className="flex justify-center">
        <Button variant="outline" size="sm" onClick={loadData}>
          <Loader2 className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      </div>
    </div>
  );
}
