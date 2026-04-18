"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, Loader2, Download, SlidersHorizontal, X } from "lucide-react";
import { UntappedNicheTable, UntappedNicheRow } from "@/components/UntappedNicheTable";
import { ChannelPerformanceGraph } from "@/components/ChannelPerformanceGraph";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";
import { LongformAiSearch } from "@/components/LongformAiSearch";
import { cn } from "@/lib/utils";

type GraphMode = "manual" | "top3_growth" | "top5_growth";

function formatRowsForExport(results: UntappedNicheRow[]) {
  return results.map((row) => {
    let popularTitle = row.firstVideoTitle;
    let popularUrl = row.firstVideoUrl;
    let popularViews = row.firstVideoViews;
    
    if (row.performanceSeries && row.performanceSeries.length > 0) {
      const best = [...row.performanceSeries].sort((a, b) => b.views - a.views)[0];
      if (best.views > popularViews) {
        popularTitle = best.title;
        popularUrl = best.videoId ? `https://www.youtube.com/watch?v=${best.videoId}` : popularUrl;
        popularViews = best.views;
      }
    }

    return {
      "Channel Name": row.channelName,
      "Channel URL": row.channelUrl,
      "Channel Creation Date": new Date(row.channelCreationDate).toISOString().slice(0, 10),
      "First Video Title": row.firstVideoTitle,
      "First Video URL": row.firstVideoUrl,
      "First Video Views": row.firstVideoViews,
      "First Video Upload Date": new Date(row.firstVideoUploadDate).toISOString().slice(0, 10),
      "Popular Video Title": popularTitle,
      "Popular Video URL": popularUrl,
      "Popular Video Views": popularViews,
      "Search Query Link": `https://www.youtube.com/results?search_query=${encodeURIComponent(row.nicheLabel)}`,
      "Niche / Sub-niche": row.nicheLabel,
      "Detected Language": row.detectedLanguage,
      "Videos Per Day": row.uploadsPerDay ?? "",
      "Estimated Competition Level": row.competitionLevel,
      "Why Untapped": row.untappedReason,
    };
  });
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<UntappedNicheRow[]>([]);
  const [previouslySearched, setPreviouslySearched] = useState<string[]>([]);
  const [languageFilter, setLanguageFilter] = useState(searchParams.get("lang") || "en");
  const [showFilters, setShowFilters] = useState(true);
  const [dateFilter, setDateFilter] = useState(searchParams.get("date") || "any");
  const [durationFilter, setDurationFilter] = useState(searchParams.get("duration") || "short");
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("to") || "");
  const [minViews, setMinViews] = useState(searchParams.get("minViews") || "");
  const [maxViews, setMaxViews] = useState(searchParams.get("maxViews") || "");
  const [maxShortsLengthSec, setMaxShortsLengthSec] = useState(searchParams.get("shortMaxSec") || "180");
  const [maxVideosPerDay, setMaxVideosPerDay] = useState(searchParams.get("maxVideosPerDay") || "");
  const [firstVideoUploadedAfter, setFirstVideoUploadedAfter] = useState(searchParams.get("firstVideoAfter") || "");
  const [selectedGraphChannels, setSelectedGraphChannels] = useState<string[]>(
    (searchParams.get("graphChannels") || "").split(",").map((item) => item.trim()).filter(Boolean)
  );
  const [graphMode, setGraphMode] = useState<GraphMode>(() => {
    const mode = searchParams.get("graphMode");
    if (mode === "top3_growth" || mode === "top5_growth" || mode === "manual") return mode;
    return "manual";
  });

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (languageFilter) params.set("lang", languageFilter);
    if (dateFilter !== "any") params.set("date", dateFilter);
    if (durationFilter !== "short") params.set("duration", durationFilter);
    if (dateFilter === "custom") {
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
    }
    if (minViews) params.set("minViews", minViews);
    if (maxViews) params.set("maxViews", maxViews);
    if (maxShortsLengthSec) params.set("shortMaxSec", maxShortsLengthSec);
    if (maxVideosPerDay) params.set("maxVideosPerDay", maxVideosPerDay);
    if (firstVideoUploadedAfter) params.set("firstVideoAfter", firstVideoUploadedAfter);
    if (selectedGraphChannels.length > 0) params.set("graphChannels", selectedGraphChannels.join(","));
    if (graphMode !== "manual") params.set("graphMode", graphMode);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [query, languageFilter, dateFilter, durationFilter, dateFrom, dateTo, minViews, maxViews, maxShortsLengthSec, maxVideosPerDay, firstVideoUploadedAfter, selectedGraphChannels, graphMode, pathname, router]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch("/api/youtube/search");
        const data = await res.json();
        if (res.ok) {
          setPreviouslySearched(data.previouslySearched || []);
        }
      } catch {
        // silent fallback for initial page render
      }
    };
    void loadHistory();
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query) return;
    let publishedAfter: string | undefined = undefined;
    let publishedBefore: string | undefined = undefined;

    if (dateFilter === "custom") {
      if (dateFrom) publishedAfter = new Date(dateFrom).toISOString();
      if (dateTo) publishedBefore = new Date(dateTo).toISOString();
    } else if (dateFilter !== "any") {
      const now = new Date();
      switch (dateFilter) {
        case "24h": now.setHours(now.getHours() - 24); break;
        case "7d": now.setDate(now.getDate() - 7); break;
        case "30d": now.setDate(now.getDate() - 30); break;
        case "3m": now.setMonth(now.getMonth() - 3); break;
        case "6m": now.setMonth(now.getMonth() - 6); break;
        case "1y": now.setFullYear(now.getFullYear() - 1); break;
        case "2y": now.setFullYear(now.getFullYear() - 2); break;
      }
      publishedAfter = now.toISOString();
    }

    setLoading(true);
    try {
      const res = await fetch("/api/youtube/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          filters: {
            language: languageFilter,
            publishedAfter,
            publishedBefore,
            videoDuration: durationFilter,
            minViews,
            maxViews,
            maxShortsLengthSec,
            maxVideosPerDay,
            firstVideoUploadedAfter: firstVideoUploadedAfter ? new Date(firstVideoUploadedAfter).toISOString() : undefined,
          },
        }),
      });
      const data = await res.json();

      if (res.ok) {
        const newResults = data.data || [];
        setResults(newResults);
        setPreviouslySearched(data.previouslySearched || []);
        toast.success(`Search complete (${newResults.length} untapped niches found)`);

        if (newResults.length > 0) {
          const rowsToExport = formatRowsForExport(newResults);
          toast.promise(
            fetch("/api/export/sheet", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query, rows: rowsToExport })
            }).then(async r => {
              if (!r.ok) {
                const err = await r.json();
                throw new Error(err.error || "Failed to export");
              }
              return r.json();
            }),
            {
              loading: "Saving results to Google Drive...",
              success: () => "Successfully saved to Google Sheets!",
              error: (err) => err.message || "Failed to automatically save to Drive."
            }
          );
        }
      } else {
        toast.error(data.error || "Search failed");
      }
    } catch {
      toast.error("Network error during search");
    }
    setLoading(false);
  };

  const activeFilters = [];
  if (dateFilter !== "any") {
    let label = dateFilter;
    if (dateFilter === "24h") label = "Last 24 hours";
    else if (dateFilter === "7d") label = "Last 7 days";
    else if (dateFilter === "30d") label = "Last 30 days";
    else if (dateFilter === "3m") label = "Last 3 months";
    else if (dateFilter === "6m") label = "Last 6 months";
    else if (dateFilter === "1y") label = "Last 1 year";
    else if (dateFilter === "2y") label = "Last 2 years";
    else if (dateFilter === "custom") label = `Custom: ${dateFrom || "*"} - ${dateTo || "*"}`;
    activeFilters.push({ id: "date", label, onRemove: () => setDateFilter("any") });
  }
  if (durationFilter !== "short") {
    let label = durationFilter;
    if (durationFilter === "short") label = "Shorts";
    else if (durationFilter === "medium") label = "Medium";
    else if (durationFilter === "long") label = "Long";
    activeFilters.push({ id: "duration", label, onRemove: () => setDurationFilter("short") });
  }
  if (languageFilter !== "en") {
    const langMap: Record<string, string> = { en: "English", es: "Spanish", fr: "French", hi: "Hindi", ta: "Tamil", ja: "Japanese", pt: "Portuguese", de: "German", ko: "Korean" };
    activeFilters.push({ id: "lang", label: langMap[languageFilter] || languageFilter, onRemove: () => setLanguageFilter("en") });
  }
  if (minViews) activeFilters.push({ id: "minViews", label: `Min ${Number(minViews).toLocaleString()} views`, onRemove: () => setMinViews("") });
  if (maxViews) activeFilters.push({ id: "maxViews", label: `Max ${Number(maxViews).toLocaleString()} views`, onRemove: () => setMaxViews("") });
  if (maxShortsLengthSec && maxShortsLengthSec !== "180") activeFilters.push({ id: "shortMaxSec", label: `Max Shorts Length ${maxShortsLengthSec}s`, onRemove: () => setMaxShortsLengthSec("180") });
  if (maxVideosPerDay) activeFilters.push({ id: "maxVideosPerDay", label: `Max ${maxVideosPerDay} videos/day`, onRemove: () => setMaxVideosPerDay("") });
  if (firstVideoUploadedAfter) activeFilters.push({ id: "firstVideoAfter", label: `First Upload After ${firstVideoUploadedAfter}`, onRemove: () => setFirstVideoUploadedAfter("") });

  const resetFilters = () => {
    setDateFilter("any");
    setDurationFilter("short");
    setLanguageFilter("en");
    setDateFrom("");
    setDateTo("");
    setMinViews("");
    setMaxViews("");
    setMaxShortsLengthSec("180");
    setMaxVideosPerDay("");
    setFirstVideoUploadedAfter("");
    setSelectedGraphChannels([]);
    setGraphMode("manual");
  };

  const downloadAsExcel = () => {
    if (results.length === 0) return;
    const rows = formatRowsForExport(results);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Untapped Shorts Niches");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `untapped_shorts_niches_${date}.xlsx`);
  };

  const totalChannels = results.length;
  const totalViews = results.reduce((acc, row) => acc + row.firstVideoViews, 0);
  const avgViews = totalChannels > 0 ? Math.round(totalViews / totalChannels) : 0;
  const avgCompetition = totalChannels > 0
    ? Number((results.reduce((acc, row) => acc + row.competitionLevel, 0) / totalChannels).toFixed(1))
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Untapped Shorts Finder</h1>
        <p className="text-muted-foreground">Find high-potential videos with optional filters for time, views, language, and upload velocity.</p>
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-2">Previously searched</h3>
        <p className="text-xs text-muted-foreground mb-3">Previously searched keywords are tracked and prior niches/channels are automatically excluded in new runs.</p>
        <div className="text-sm">
          {previouslySearched.length > 0 ? previouslySearched.join(", ") : "No previous searches yet."}
        </div>
      </Card>

      <div className="flex gap-4 items-end flex-wrap">
        <form onSubmit={handleSearch} className="flex-1 max-w-2xl flex gap-2 relative">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Enter niche/topic keywords (e.g. ai horror stories)"
            className="pl-10 h-12 text-lg bg-card"
          />
          <Search className="w-5 h-5 absolute left-3 top-3.5 text-muted-foreground" />
          <Button type="submit" size="lg" disabled={loading}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Find Untapped Niches"}
          </Button>
        </form>

        <Button variant={showFilters ? "default" : "outline"} size="lg" onClick={() => setShowFilters(!showFilters)}>
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          Filters
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {showFilters && (
          <Card className="w-full lg:w-64 p-4 shrink-0 space-y-6">
            <div>
              <h3 className="font-semibold mb-4 flex justify-between items-center text-sm">
                Filters
                <Button variant="ghost" size="sm" onClick={resetFilters} className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground">
                  Reset
                </Button>
              </h3>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Published Within</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger><SelectValue placeholder="Any time" /></SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="any">Any time</SelectItem>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="3m">Last 3 months</SelectItem>
                  <SelectItem value="6m">Last 6 months</SelectItem>
                  <SelectItem value="1y">Last 1 year</SelectItem>
                  <SelectItem value="2y">Last 2 years</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>
              {dateFilter === "custom" && (
                <div className="flex flex-col gap-2">
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs w-full" />
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs w-full" />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Video Duration</label>
              <Select value={durationFilter} onValueChange={setDurationFilter}>
                <SelectTrigger><SelectValue placeholder="Any duration" /></SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="short">Shorts</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Duration mode is enforced (short/medium/long). Shorts max-length applies only in short mode.</p>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Max Shorts Length (seconds)</label>
              <Input
                type="number"
                min={1}
                max={180}
                placeholder="180"
                value={maxShortsLengthSec}
                onChange={e => setMaxShortsLengthSec(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Language</label>
              <Select value={languageFilter} onValueChange={setLanguageFilter}>
                <SelectTrigger><SelectValue placeholder="Language" /></SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                  <SelectItem value="ta">Tamil</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                  <SelectItem value="pt">Portuguese</SelectItem>
                  <SelectItem value="ja">Japanese</SelectItem>
                  <SelectItem value="ko">Korean</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Video Views</label>
              <div className="flex gap-2">
                <Input type="number" placeholder="Min" value={minViews} onChange={e => setMinViews(e.target.value)} className="h-8 text-xs" />
                <Input type="number" placeholder="Max" value={maxViews} onChange={e => setMaxViews(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Max Videos Posted / Day</label>
              <Input
                type="number"
                min={0}
                step="0.1"
                placeholder="1, 2, 3..."
                value={maxVideosPerDay}
                onChange={e => setMaxVideosPerDay(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">First Video Uploaded After</label>
              <Input
                type="date"
                value={firstVideoUploadedAfter}
                onChange={e => setFirstVideoUploadedAfter(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </Card>
        )}

        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {results.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Matched Channels</p>
                <p className="text-2xl font-bold">{totalChannels.toLocaleString()}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Total Views</p>
                <p className="text-2xl font-bold">{totalViews.toLocaleString()}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Average Views</p>
                <p className="text-2xl font-bold">{avgViews.toLocaleString()}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Average Competition</p>
                <p className="text-2xl font-bold">{avgCompetition}</p>
              </Card>
            </div>
          )}
          {results.length > 0 && (
            <ChannelPerformanceGraph
              data={results}
              selectedChannelIds={selectedGraphChannels}
              onSelectedChannelIdsChange={setSelectedGraphChannels}
              growthMode={graphMode}
              onGrowthModeChange={setGraphMode}
            />
          )}
          <Card className="flex flex-col overflow-hidden">
          {activeFilters.length > 0 && results.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 py-3 bg-muted/30 border-b items-center">
              <span className="text-xs font-semibold text-muted-foreground mr-1 uppercase">Active Filters:</span>
              {activeFilters.map(f => (
                <Badge key={f.id} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1 font-normal bg-background border">
                  {f.label}
                  <Button variant="ghost" size="icon" className="h-4 w-4 rounded-full ml-1 text-muted-foreground" onClick={f.onRemove}>
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
          <div className="overflow-x-auto p-0">
            {results.length > 0 ? (
              <UntappedNicheTable data={results} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                {loading ? "Scanning YouTube Shorts for untapped new-channel opportunities..." : "Run a niche search to see results"}
              </div>
            )}
          </div>
          </Card>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={downloadAsExcel} disabled={results.length === 0} className="min-w-52">
          <Download className="w-4 h-4 mr-2" />
          Download as Excel
        </Button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [mode, setMode] = useState<"shorts" | "ai-longform">("shorts");

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex gap-2 bg-card p-1 rounded-lg border border-border w-fit shrink-0">
        <button 
          onClick={() => setMode("shorts")}
          className={cn("px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-colors", mode === "shorts" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted")}
        >
          Untapped Shorts Finder
        </button>
        <button 
          onClick={() => setMode("ai-longform")}
          className={cn("px-4 py-2 text-sm font-medium rounded-md focus:outline-none transition-colors", mode === "ai-longform" ? "bg-primary text-primary-foreground shadow-sm bg-blue-600 text-white" : "text-muted-foreground hover:bg-muted")}
        >
          Longform AI Search ⚡
        </button>
      </div>
      <div className="flex-1">
        <Suspense fallback={<div className="p-8 h-full flex justify-center items-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mr-2"/> Loading dashboard...</div>}>
          {mode === "shorts" ? <DashboardContent /> : <LongformAiSearch />}
        </Suspense>
      </div>
    </div>
  );
}
