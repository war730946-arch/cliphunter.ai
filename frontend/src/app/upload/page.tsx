"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { videoApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload, Link2, FileVideo, X, Loader2, CheckCircle, AlertCircle,
  Film, ExternalLink, Info,
} from "lucide-react";

// ─── Validation Schemas ──────────────────────────────────
const urlSchema = z.object({
  source_url: z
    .string()
    .min(1, "Please enter a video URL")
    .url("Please enter a valid URL (must start with http:// or https://)"),
  title: z.string().max(200, "Title too long").optional(),
});

const fileSchema = z.object({
  title: z.string().max(200, "Title too long").optional(),
});

type UrlFormData = z.infer<typeof urlSchema>;
type FileFormData = z.infer<typeof fileSchema>;

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
const ALLOWED_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv"];
const ALLOWED_TYPES = [
  "video/mp4", "video/webm", "video/ogg",
  "video/quicktime", "video/x-msvideo", "video/x-matroska",
];

const FILE_SIZE_LIMIT = "200MB";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [method, setMethod] = useState<"file" | "url">("file");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null);

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // URL form
  const urlForm = useForm<UrlFormData>({
    resolver: zodResolver(urlSchema),
    defaultValues: { source_url: "", title: "" },
  });

  // File form (for title)
  const fileForm = useForm<FileFormData>({
    resolver: zodResolver(fileSchema),
    defaultValues: { title: "" },
  });

  // Submitted video info
  const [submittedVideo, setSubmittedVideo] = useState<{
    id: string;
    title: string | null;
    status: string;
  } | null>(null);

  // ─── File Validation ────────────────────────────────────
  const validateFile = useCallback((file: File | null): string | null => {
    if (!file) return "No file selected";

    if (file.size > MAX_FILE_SIZE) {
      return `File is too large. Maximum allowed is ${FILE_SIZE_LIMIT}. This file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`;
    }

    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Invalid format. Supported: ${ALLOWED_EXTENSIONS.join(", ")}`;
    }

    return null;
  }, []);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setError(null);
    setFileError(null);
    const file = e.dataTransfer.files[0];
    const validationError = validateFile(file);
    if (validationError) {
      setFileError(validationError);
      return;
    }
    setSelectedFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateFile(file);
    if (validationError) {
      setFileError(validationError);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Submit ─────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      if (method === "file") {
        if (!selectedFile) {
          setError("Please select a video file to upload.");
          setIsSubmitting(false);
          return;
        }

        const formData = new FormData();
        formData.append("video", selectedFile);
        const titleVal = fileForm.getValues("title");
        if (titleVal) formData.append("title", titleVal);
        const res = await videoApi.createFromFile(formData);
        const vid = res.data.data.video;
        setUploadedVideoId(vid.id);
        setSubmittedVideo({ id: vid.id, title: vid.title, status: vid.status });
        setSuccess("Video uploaded! Processing will start shortly.");
      } else {
        const urlData = urlForm.getValues();
        const validation = urlSchema.safeParse(urlData);
        if (!validation.success) {
          setError(validation.error.issues[0].message);
          setIsSubmitting(false);
          return;
        }
        const res = await videoApi.createFromUrl({
          source_url: urlData.source_url,
          title: urlData.title || undefined,
        });
        const vid = res.data.data.video;
        setUploadedVideoId(vid.id);
        setSubmittedVideo({ id: vid.id, title: vid.title, status: vid.status });
        setSuccess("URL submitted! Processing will start shortly.");
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Upload failed. Please try again.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Upload Video</h1>
        <p className="text-zinc-400 mt-1">
          Upload a video file or paste a URL to generate AI highlights
        </p>
      </div>

      {/* Method Tabs */}
      <Tabs value={method} onValueChange={(v) => { setMethod(v as "file" | "url"); setError(null); setSuccess(null); setFileError(null); }}>
        <TabsList className="w-full">
          <TabsTrigger value="file" className="flex-1 gap-2">
            <FileVideo className="h-4 w-4" />
            Upload File
          </TabsTrigger>
          <TabsTrigger value="url" className="flex-1 gap-2">
            <Link2 className="h-4 w-4" />
            From URL
          </TabsTrigger>
        </TabsList>

        {/* Error / Success */}
        {error && (
          <div className="flex items-center gap-3 p-4 mt-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-3 p-4 mt-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
            {success}
          </div>
        )}

        <TabsContent value="file" className="mt-4 space-y-4">
          {/* File drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => !selectedFile && fileInputRef.current?.click()}
            className={`relative rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-200 ${
              dragOver
                ? "border-violet-500 bg-violet-500/5 scale-[1.02]"
                : selectedFile
                ? "border-emerald-500/50 bg-emerald-500/5"
                : "border-zinc-600 hover:border-zinc-500 bg-zinc-800/30 hover:bg-zinc-800/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_TYPES.join(",")}
              onChange={handleFileSelect}
              className="hidden"
            />

            {selectedFile ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald-500/20">
                    <FileVideo className="h-8 w-8 text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-base font-medium text-white break-all">{selectedFile.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="success" className="text-[10px]">{formatFileSize(selectedFile.size)}</Badge>
                      <span className="text-xs text-zinc-500">Ready to upload</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(); }}
                  className="inline-flex items-center gap-1 text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  <X className="h-3 w-3" /> Remove file
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="p-4 rounded-2xl bg-zinc-800/50 ring-1 ring-zinc-700/50">
                    <Upload className="h-10 w-10 text-zinc-500" />
                  </div>
                </div>
                <div>
                  <p className="text-lg font-medium text-zinc-300">
                    Drop your video here
                  </p>
                  <p className="text-sm text-zinc-500 mt-2">
                    or click to browse &bull; MP4, WebM, MOV, AVI, MKV up to {FILE_SIZE_LIMIT}
                  </p>
                </div>
              </div>
            )}
          </div>

          {fileError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {fileError}
            </div>
          )}

          {/* Optional title */}
          <div className="space-y-1.5">
            <Label htmlFor="file-title">
              Title <span className="text-zinc-500 font-normal">(optional)</span>
            </Label>
            <Input
              id="file-title"
              {...fileForm.register("title")}
              placeholder="My Amazing Video"
            />
          </div>
        </TabsContent>

        <TabsContent value="url" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="source_url">
                  Video URL <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    id="source_url"
                    {...urlForm.register("source_url")}
                    type="url"
                    placeholder="https://example.com/video.mp4"
                    className="pl-10"
                  />
                </div>
                {urlForm.formState.errors.source_url && (
                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {urlForm.formState.errors.source_url.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="url-title">
                  Title <span className="text-zinc-500 font-normal">(optional)</span>
                </Label>
                <Input
                  id="url-title"
                  {...urlForm.register("title")}
                  placeholder="My Amazing Video"
                />
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-700/30 text-xs text-zinc-400">
                <Info className="h-3.5 w-3.5 flex-shrink-0" />
                Enter a direct URL to a video file (MP4, WebM, etc.) or a supported platform link
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting || (method === "file" ? !selectedFile : !urlForm.watch("source_url"))}
        size="lg"
        className="w-full"
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Processing...
          </span>
        ) : success && uploadedVideoId ? (
          <span className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Submitted
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {method === "file" ? "Upload & Analyze" : "Submit URL"}
          </span>
        )}
      </Button>

      {/* Success state */}
      {success && submittedVideo && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-emerald-500/20">
                <CheckCircle className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Video Submitted Successfully</h3>
                <p className="text-xs text-zinc-400">
                  {submittedVideo.title || "Untitled Video"} &bull; Status:{" "}
                  <Badge variant={submittedVideo.status === "ready" ? "success" : "warning"} className="text-[10px] ml-1">
                    {submittedVideo.status}
                  </Badge>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-700/30">
              <div className="p-2 rounded-lg bg-violet-500/20">
                <Film className="h-5 w-5 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{submittedVideo.title || "Untitled Video"}</p>
                <p className="text-xs text-zinc-500">ID: {submittedVideo.id.slice(0, 12)}...</p>
              </div>
              <ExternalLink className="h-4 w-4 text-zinc-500 flex-shrink-0" />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={() => router.push(`/videos/${uploadedVideoId}`)} className="flex-1">
                View Video Details &rarr;
              </Button>
              <Button variant="outline" onClick={() => router.push("/dashboard")} className="flex-1">
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
