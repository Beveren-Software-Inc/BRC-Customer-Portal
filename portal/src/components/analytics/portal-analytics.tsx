"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Clock,
  Eye,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getPortalAnalyticsDashboard } from "@/lib/api";
import { formatDate } from "@/lib/utils";

function defaultFromDate() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

function defaultToDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDurationMinutes(seconds?: number | null) {
  if (!seconds) return "0";
  return (Math.round((seconds / 60) * 10) / 10).toString();
}

export default function PortalAnalyticsPage() {
  const { t } = useTranslation();
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["portal-analytics", fromDate, toDate],
    queryFn: () => getPortalAnalyticsDashboard(fromDate, toDate),
  });

  const summaryCards = useMemo(() => {
    const summary = data?.summary;
    return [
      {
        title: t("Total Logins"),
        value: summary?.total_logins ?? 0,
        icon: Users,
      },
      {
        title: t("Unique Users"),
        value: summary?.unique_users ?? 0,
        icon: BarChart3,
      },
      {
        title: t("Avg. Session (min)"),
        value: summary?.avg_duration_minutes ?? 0,
        icon: Clock,
      },
      {
        title: t("Total Page Views"),
        value: summary?.total_page_views ?? 0,
        icon: Eye,
      },
      {
        title: t("Browsing Sessions"),
        value: summary?.total_portal_sessions ?? 0,
        icon: BarChart3,
      },
    ];
  }, [data?.summary, t]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("Portal Analytics")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("Logins are tracked from Activity Log. Page refreshes are not counted as logins.")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="from_date">{t("From Date")}</Label>
            <Input
              id="from_date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to_date">{t("To Date")}</Label>
            <Input
              id="to_date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="shrink-0"
          >
            {isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {t("Refresh")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t("Loading analytics...")}
        </div>
      ) : isError || !data?.success ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t("Unable to load portal analytics.")}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {summaryCards.map((card) => (
              <Card key={card.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {card.title}
                  </CardTitle>
                  <card.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{card.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <AnalyticsTable
              title={t("Usage by User")}
              headers={[t("User"), t("Logins"), t("Page Views"), t("Avg. min"), t("Last Login")]}
              rows={(data.per_user || []).map((row) => [
                row.full_name || row.user,
                String(row.login_count || 0),
                String(row.page_views || 0),
                formatDurationMinutes(row.avg_duration_seconds),
                row.last_login ? formatDate(row.last_login) : "-",
              ])}
            />

            <AnalyticsTable
              title={t("Top Pages")}
              headers={[t("Page"), t("Path"), t("Visits")]}
              rows={(data.top_pages || []).map((row) => [
                row.page_title || row.page_path,
                row.page_path,
                String(row.visits || 0),
              ])}
            />
          </div>

          <AnalyticsTable
            title={t("Daily Logins")}
            headers={[t("Date"), t("Logins"), t("Unique Users")]}
            rows={(data.daily_logins || []).map((row) => [
              row.day,
              String(row.logins || 0),
              String(row.unique_users || 0),
            ])}
          />

          <Card>
            <CardHeader>
              <CardTitle>{t("Recent Sessions")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Session")}</TableHead>
                    <TableHead>{t("User")}</TableHead>
                    <TableHead>{t("Customer")}</TableHead>
                    <TableHead>{t("Started")}</TableHead>
                    <TableHead className="text-right">{t("Duration (min)")}</TableHead>
                    <TableHead className="text-right">{t("Pages")}</TableHead>
                    <TableHead>{t("Status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data.recent_sessions || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        {t("No sessions in this period")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    (data.recent_sessions || []).map((row) => (
                      <TableRow key={row.name}>
                        <TableCell className="font-mono text-xs">{row.name}</TableCell>
                        <TableCell>{row.full_name || row.user}</TableCell>
                        <TableCell>{row.customer || "-"}</TableCell>
                        <TableCell>
                          {row.session_start ? formatDate(row.session_start) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatDurationMinutes(row.duration_seconds)}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.page_view_count || 0}
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.status === "Open" ? "default" : "secondary"}>
                            {row.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function AnalyticsTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={headers.length} className="text-center text-muted-foreground">
                  No data
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={`${title}-${index}`}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={`${title}-${index}-${cellIndex}`}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
