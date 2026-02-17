import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MetricsCard } from "@/components/admin/MetricsCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DollarSign, 
  Clock, 
  TrendingUp, 
  BarChart3, 
  Users, 
  Zap,
  Globe,
  Activity,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";

interface EconomicsSnapshot {
  period: { start: string; end: string };
  totalSessions: number;
  totalDurationHours: number;
  totalExchanges: number;
  uniqueUsers: number;
  costs: {
    tts: number;
    stt: number;
    llm: number;
    platform: number;
    total: number;
    perHour: number;
    perSession: number;
    perExchange: number;
  };
  revenue: {
    creditsConsumedSeconds: number;
    creditsConsumedHours: number;
  };
  byLanguage: Array<{
    language: string;
    sessions: number;
    hours: number;
    exchanges: number;
    costTotal: number;
    costPerHour: number;
  }>;
  byDay: Array<{
    date: string;
    sessions: number;
    durationMinutes: number;
    exchanges: number;
    costTotal: number;
    users: number;
  }>;
  telemetryHealth: {
    sessionsWithTelemetry: number;
    sessionsWithoutTelemetry: number;
    telemetryCoveragePercent: number;
  };
}

interface PricingAnalysis {
  currentCostPerHour: number;
  recommendedMinPrice: number;
  recommendedRetailPrice: number;
  marginAt5PerHour: number;
  marginAt10PerHour: number;
  breakEvenPrice: number;
  institutionalPackageAnalysis: Array<{
    tier: string;
    pricePerStudent: number;
    hoursPerStudent: number;
    costPerStudent: number;
    profitPerStudent: number;
    marginPercent: number;
  }>;
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  return `${hours.toFixed(1)}h`;
}

function CostBreakdownBar({ tts, stt, llm, platform }: { tts: number; stt: number; llm: number; platform: number }) {
  const total = tts + stt + llm + platform;
  if (total === 0) return null;
  
  const segments = [
    { label: 'TTS', value: tts, color: 'bg-blue-500' },
    { label: 'STT', value: stt, color: 'bg-green-500' },
    { label: 'LLM', value: llm, color: 'bg-purple-500' },
    { label: 'Platform', value: platform, color: 'bg-orange-500' },
  ];

  return (
    <div data-testid="cost-breakdown-bar">
      <div className="flex h-3 rounded-md overflow-hidden mb-2">
        {segments.map(seg => (
          <div
            key={seg.label}
            className={`${seg.color} transition-all`}
            style={{ width: `${(seg.value / total) * 100}%` }}
            title={`${seg.label}: ${formatCurrency(seg.value)} (${Math.round((seg.value / total) * 100)}%)`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {segments.map(seg => (
          <span key={seg.label} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${seg.color}`} />
            {seg.label}: {formatCurrency(seg.value)} ({Math.round((seg.value / total) * 100)}%)
          </span>
        ))}
      </div>
    </div>
  );
}

function DailyChart({ data }: { data: EconomicsSnapshot['byDay'] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">No daily data available</p>;
  
  const last30 = data.slice(-30);
  const maxCost = Math.max(...last30.map(d => d.costTotal), 0.01);
  const maxSessions = Math.max(...last30.map(d => d.sessions), 1);

  return (
    <div data-testid="daily-chart" className="space-y-1">
      <div className="flex items-end gap-[2px] h-32">
        {last30.map((day, i) => (
          <div
            key={day.date}
            className="flex-1 flex flex-col items-center justify-end gap-[1px]"
            title={`${day.date}: ${day.sessions} sessions, ${formatCurrency(day.costTotal)}, ${day.users} users`}
          >
            <div
              className="w-full bg-blue-500/70 rounded-t-sm transition-all"
              style={{ height: `${Math.max(2, (day.costTotal / maxCost) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{last30[0]?.date?.slice(5)}</span>
        <span>{last30[last30.length - 1]?.date?.slice(5)}</span>
      </div>
      <p className="text-xs text-muted-foreground text-center">Daily cost (last 30 days)</p>
    </div>
  );
}

export default function SessionEconomicsPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [language, setLanguage] = useState('all');

  const queryParams = new URLSearchParams();
  if (startDate) queryParams.set('startDate', startDate);
  if (endDate) queryParams.set('endDate', endDate);
  if (language && language !== 'all') queryParams.set('language', language);
  const qs = queryParams.toString();
  const snapshotUrl = qs ? `/api/admin/session-economics?${qs}` : '/api/admin/session-economics';

  const { data: snapshot, isLoading } = useQuery<EconomicsSnapshot>({
    queryKey: ['/api/admin/session-economics', startDate, endDate, language],
    queryFn: async () => {
      const res = await fetch(snapshotUrl, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch economics data');
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: pricing } = useQuery<PricingAnalysis>({
    queryKey: ['/api/admin/session-economics/pricing'],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Session Economics</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const s = snapshot;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" data-testid="page-session-economics">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Session Economics</h1>
          <p className="text-sm text-muted-foreground">
            Real cost analysis from {s?.totalSessions || 0} voice sessions
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-36"
            data-testid="input-start-date"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-36"
            data-testid="input-end-date"
          />
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-32" data-testid="select-language-filter">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Languages</SelectItem>
              <SelectItem value="spanish">Spanish</SelectItem>
              <SelectItem value="french">French</SelectItem>
              <SelectItem value="german">German</SelectItem>
              <SelectItem value="italian">Italian</SelectItem>
              <SelectItem value="portuguese">Portuguese</SelectItem>
              <SelectItem value="japanese">Japanese</SelectItem>
              <SelectItem value="mandarin">Mandarin</SelectItem>
              <SelectItem value="korean">Korean</SelectItem>
              <SelectItem value="english">English</SelectItem>
              <SelectItem value="hebrew">Hebrew</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {s && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricsCard
              title="Cost Per Hour"
              value={formatCurrency(s.costs.perHour)}
              description="All-in cost including platform overhead"
              icon={DollarSign}
            />
            <MetricsCard
              title="Total Hours Delivered"
              value={formatHours(s.totalDurationHours)}
              description={`${s.totalSessions} sessions, ${s.uniqueUsers} users`}
              icon={Clock}
            />
            <MetricsCard
              title="Total Cost"
              value={formatCurrency(s.costs.total)}
              description={`${formatCurrency(s.costs.perSession)} per session avg`}
              icon={BarChart3}
            />
            <MetricsCard
              title="Credits Consumed"
              value={formatHours(s.revenue.creditsConsumedHours)}
              description={`${s.revenue.creditsConsumedSeconds.toLocaleString()}s total`}
              icon={Zap}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Cost Breakdown
                </CardTitle>
                <CardDescription>Where the money goes per session</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CostBreakdownBar
                  tts={s.costs.tts}
                  stt={s.costs.stt}
                  llm={s.costs.llm}
                  platform={s.costs.platform}
                />
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Per Exchange</p>
                    <p className="text-lg font-semibold" data-testid="text-cost-per-exchange">{formatCurrency(s.costs.perExchange)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Exchanges</p>
                    <p className="text-lg font-semibold" data-testid="text-total-exchanges">{s.totalExchanges.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Daily Trend
                </CardTitle>
                <CardDescription>Cost over time</CardDescription>
              </CardHeader>
              <CardContent>
                <DailyChart data={s.byDay} />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  By Language
                </CardTitle>
              </CardHeader>
              <CardContent>
                {s.byLanguage.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No language data</p>
                ) : (
                  <div className="space-y-3">
                    {s.byLanguage.map(lang => (
                      <div key={lang.language} className="flex items-center justify-between" data-testid={`row-language-${lang.language}`}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize">{lang.language}</span>
                          <Badge variant="secondary">{lang.sessions} sessions</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{formatHours(lang.hours)}</span>
                          <span className="font-medium text-foreground">{formatCurrency(lang.costPerHour)}/hr</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {s.telemetryHealth.telemetryCoveragePercent > 50 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  )}
                  Telemetry Health
                </CardTitle>
                <CardDescription>How much real data vs estimates we're using</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Coverage</span>
                  <Badge variant={s.telemetryHealth.telemetryCoveragePercent > 50 ? "default" : "secondary"}>
                    {s.telemetryHealth.telemetryCoveragePercent}%
                  </Badge>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${s.telemetryHealth.telemetryCoveragePercent}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">With telemetry</p>
                    <p className="font-semibold">{s.telemetryHealth.sessionsWithTelemetry}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Estimated</p>
                    <p className="font-semibold">{s.telemetryHealth.sessionsWithoutTelemetry}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  New sessions will have real TTS/STT telemetry. Historical sessions use estimates based on exchange count.
                </p>
              </CardContent>
            </Card>
          </div>

          {pricing && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Pricing Intelligence
                </CardTitle>
                <CardDescription>Based on actual cost per hour of {formatCurrency(pricing.currentCostPerHour)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Break-even</p>
                    <p className="text-lg font-semibold" data-testid="text-breakeven">{formatCurrency(pricing.breakEvenPrice)}/hr</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Min. Price (50% margin)</p>
                    <p className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">{formatCurrency(pricing.recommendedMinPrice)}/hr</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Retail (200% margin)</p>
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400">{formatCurrency(pricing.recommendedRetailPrice)}/hr</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Margin @ $5/hr</p>
                    <p className="text-lg font-semibold">{pricing.marginAt5PerHour}%</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-3">Institutional Package Analysis</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-pricing-analysis">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-medium">Tier</th>
                          <th className="pb-2 font-medium">Price</th>
                          <th className="pb-2 font-medium">Hours</th>
                          <th className="pb-2 font-medium">Cost</th>
                          <th className="pb-2 font-medium">Profit</th>
                          <th className="pb-2 font-medium">Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pricing.institutionalPackageAnalysis.map(pkg => (
                          <tr key={pkg.tier} className="border-b last:border-0" data-testid={`row-package-${pkg.tier.toLowerCase().replace(/\s+/g, '-')}`}>
                            <td className="py-2 font-medium">{pkg.tier}</td>
                            <td className="py-2">{formatCurrency(pkg.pricePerStudent)}</td>
                            <td className="py-2">{pkg.hoursPerStudent}h</td>
                            <td className="py-2">{formatCurrency(pkg.costPerStudent)}</td>
                            <td className="py-2">
                              <span className={pkg.profitPerStudent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                {formatCurrency(pkg.profitPerStudent)}
                              </span>
                            </td>
                            <td className="py-2">
                              <Badge variant={pkg.marginPercent >= 50 ? "default" : "secondary"}>
                                {pkg.marginPercent}%
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
