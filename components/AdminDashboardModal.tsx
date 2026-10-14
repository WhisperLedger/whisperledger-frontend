import React, { useEffect, useState, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api";

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface TelemetryData {
  service: string;
  region: string;
  revision: string;
  environment: string;
  status: string;
  uptime_seconds: number;
  go_version: string;
  memory_alloc_mb: number;
  memory_sys_mb: number;
  db_pool_total: number;
  db_pool_idle: number;
  db_pool_acquired: number;
  daily_volumes: Array<{ date: string; amount: number; count: number }>;
  recent_logs: Array<{ timestamp: string; level: string; message: string; source: string }>;
  gcp_console_links: Record<string, string>;
}

interface MetricsData {
  total_users: number;
  total_households: number;
  total_expenses_tracked: number;
  total_volume_tracked: number;
  total_receivables_pending: number;
  active_users_7_days: number;
}

export default function AdminDashboardModal({ visible, onClose }: Props) {
  const colors = useColors();
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pingMs, setPingMs] = useState<number | null>(null);

  const loadDashboard = useCallback(async () => {
    const start = Date.now();
    try {
      const [tRes, mRes] = await Promise.all([
        api.getCloudTelemetry(),
        api.getPlatformMetrics(),
      ]);

      setPingMs(Date.now() - start);

      if (tRes.success && tRes.data) {
        setTelemetry(tRes.data as TelemetryData);
      }
      if (mRes.success && mRes.data) {
        setMetrics(mRes.data as MetricsData);
      }
    } catch (e) {
      console.warn("Failed to load admin telemetry", e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      loadDashboard();
    }
  }, [visible, loadDashboard]);

  const formatUptime = (seconds?: number) => {
    if (!seconds) return "0m";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  const openLink = (url?: string) => {
    if (url) {
      Linking.openURL(url).catch((err) => console.warn("Failed to open link", err));
    }
  };

  // Find max volume for proportional bar chart rendering
  const maxVolume = telemetry?.daily_volumes?.reduce((max, d) => Math.max(max, d.amount), 1) || 1;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Cloud Metrics & Telemetry</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: "#10b981" }]} />
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {telemetry?.service || "Cloud Run"} • {telemetry?.region || "asia-south1"}
                {pingMs !== null ? ` • ${pingMs}ms latency` : ""}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.muted }]}>
            <Feather name="x" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Fetching live cloud telemetry...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); loadDashboard(); }} />}
          >
            {/* Quick KPI Grid */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Platform Scale</Text>
            <View style={styles.kpiGrid}>
              <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="trending-up" size={18} color="#10b981" />
                <Text style={[styles.kpiValue, { color: colors.text }]}>
                  ₹{(metrics?.total_volume_tracked || 0).toLocaleString("en-IN")}
                </Text>
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Volume Tracked</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="users" size={18} color="#0EA5E9" />
                <Text style={[styles.kpiValue, { color: colors.text }]}>{metrics?.total_users || 0}</Text>
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Registered Users</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="home" size={18} color="#8B5CF6" />
                <Text style={[styles.kpiValue, { color: colors.text }]}>{metrics?.total_households || 0}</Text>
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Households</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="activity" size={18} color="#F59E0B" />
                <Text style={[styles.kpiValue, { color: colors.text }]}>{metrics?.active_users_7_days || 0}</Text>
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Active (7 Days)</Text>
              </View>
            </View>

            {/* Cloud Infrastructure Telemetry */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Infrastructure & Runtime</Text>
            <View style={[styles.infraCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.infraRow}>
                <Text style={[styles.infraLabel, { color: colors.mutedForeground }]}>Active Revision</Text>
                <Text style={[styles.infraValue, { color: colors.text }]}>{telemetry?.revision || "N/A"}</Text>
              </View>
              <View style={styles.infraRow}>
                <Text style={[styles.infraLabel, { color: colors.mutedForeground }]}>Database Pool (Neon)</Text>
                <Text style={[styles.infraValue, { color: "#10b981" }]}>
                  {telemetry?.db_pool_acquired || 0} active / {telemetry?.db_pool_idle || 0} idle (max {telemetry?.db_pool_total || 10})
                </Text>
              </View>
              <View style={styles.infraRow}>
                <Text style={[styles.infraLabel, { color: colors.mutedForeground }]}>Memory (Alloc / Sys)</Text>
                <Text style={[styles.infraValue, { color: colors.text }]}>
                  {(telemetry?.memory_alloc_mb || 0).toFixed(1)} MB / {(telemetry?.memory_sys_mb || 0).toFixed(1)} MB
                </Text>
              </View>
              <View style={styles.infraRow}>
                <Text style={[styles.infraLabel, { color: colors.mutedForeground }]}>Service Uptime</Text>
                <Text style={[styles.infraValue, { color: colors.text }]}>{formatUptime(telemetry?.uptime_seconds)}</Text>
              </View>
              <View style={styles.infraRow}>
                <Text style={[styles.infraLabel, { color: colors.mutedForeground }]}>Go Version</Text>
                <Text style={[styles.infraValue, { color: colors.text }]}>{telemetry?.go_version || "go1.26"}</Text>
              </View>
            </View>

            {/* Visual 14-Day Activity Graph */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>14-Day Transaction Trend</Text>
            <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {telemetry?.daily_volumes && telemetry.daily_volumes.length > 0 ? (
                <View style={styles.chartContainer}>
                  {telemetry.daily_volumes.map((d, index) => {
                    const heightPercent = Math.max(12, Math.round((d.amount / maxVolume) * 100));
                    return (
                      <View key={index} style={styles.barCol}>
                        <View style={styles.barWrapper}>
                          <View
                            style={[
                              styles.bar,
                              {
                                height: `${heightPercent}%`,
                                backgroundColor: colors.primary,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.barDate, { color: colors.mutedForeground }]}>
                          {d.date.slice(8, 10)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyChart}>
                  <Feather name="bar-chart-2" size={32} color={colors.mutedForeground} />
                  <Text style={[styles.emptyChartText, { color: colors.mutedForeground }]}>
                    Volume distribution will chart as transactions are logged
                  </Text>
                </View>
              )}
            </View>

            {/* Live Operational System Logs */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Live Operational Event Feed</Text>
            <View style={[styles.logsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {telemetry?.recent_logs && telemetry.recent_logs.length > 0 ? (
                telemetry.recent_logs.map((log, index) => (
                  <View key={index} style={[styles.logItem, { borderBottomColor: colors.border }]}>
                    <View style={styles.logHeader}>
                      <View
                        style={[
                          styles.levelBadge,
                          {
                            backgroundColor:
                              log.level === "ERROR"
                                ? "rgba(239, 68, 68, 0.15)"
                                : log.level === "WARN"
                                ? "rgba(245, 158, 11, 0.15)"
                                : "rgba(16, 185, 129, 0.15)",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.levelText,
                            {
                              color:
                                log.level === "ERROR" ? "#ef4444" : log.level === "WARN" ? "#f59e0b" : "#10b981",
                            },
                          ]}
                        >
                          {log.level}
                        </Text>
                      </View>
                      <Text style={[styles.logTime, { color: colors.mutedForeground }]}>
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </Text>
                      <Text style={[styles.logSource, { color: colors.mutedForeground }]}>[{log.source}]</Text>
                    </View>
                    <Text style={[styles.logMessage, { color: colors.text }]}>{log.message}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.noLogsText, { color: colors.mutedForeground }]}>No system events recorded yet.</Text>
              )}
            </View>

            {/* Direct GCP Console Links */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>GCP Cloud Management Shortcuts</Text>
            <View style={styles.linksGrid}>
              <TouchableOpacity
                style={[styles.consoleButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => openLink(telemetry?.gcp_console_links?.cloud_run)}
              >
                <Feather name="activity" size={18} color="#0EA5E9" />
                <Text style={[styles.consoleButtonText, { color: colors.text }]}>Cloud Run Metrics</Text>
                <Feather name="external-link" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.consoleButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => openLink(telemetry?.gcp_console_links?.cloud_logging)}
              >
                <Feather name="file-text" size={18} color="#8B5CF6" />
                <Text style={[styles.consoleButtonText, { color: colors.text }]}>Cloud Logs Explorer</Text>
                <Feather name="external-link" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.consoleButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => openLink(telemetry?.gcp_console_links?.neon_console)}
              >
                <Feather name="database" size={18} color="#10B981" />
                <Text style={[styles.consoleButtonText, { color: colors.text }]}>Neon DB Console</Text>
                <Feather name="external-link" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  subtitle: {
    fontSize: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 10,
    marginTop: 14,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpiCard: {
    flexBasis: "48%",
    flexGrow: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },
  kpiLabel: {
    fontSize: 12,
  },
  infraCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  infraRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infraLabel: {
    fontSize: 13,
  },
  infraValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  chartCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    minHeight: 140,
    justifyContent: "center",
  },
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 120,
    paddingTop: 10,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    height: "100%",
  },
  barWrapper: {
    flex: 1,
    width: 14,
    justifyContent: "flex-end",
    backgroundColor: "rgba(100, 116, 139, 0.1)",
    borderRadius: 6,
    overflow: "hidden",
  },
  bar: {
    width: "100%",
    borderRadius: 6,
  },
  barDate: {
    fontSize: 10,
    marginTop: 4,
  },
  emptyChart: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 20,
  },
  emptyChartText: {
    fontSize: 13,
    textAlign: "center",
  },
  logsContainer: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    maxHeight: 280,
  },
  logItem: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  levelText: {
    fontSize: 10,
    fontWeight: "700",
  },
  logTime: {
    fontSize: 11,
  },
  logSource: {
    fontSize: 11,
  },
  logMessage: {
    fontSize: 12,
    lineHeight: 16,
  },
  noLogsText: {
    fontSize: 13,
    paddingVertical: 16,
    textAlign: "center",
  },
  linksGrid: {
    gap: 10,
  },
  consoleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  consoleButtonText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    fontWeight: "500",
  },
});
