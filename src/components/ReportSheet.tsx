import React, { memo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { Toilet } from "../types/toilet";
import { openReport } from "../services/report";
import { t } from "../i18n";

interface ReportSheetProps {
  toilet?: Toilet;
  visible: boolean;
  onClose: () => void;
}

const OPTIONS = [
  { type: "confirm" as const, icon: "✅" },
  { type: "wrong" as const, icon: "✏️" },
  { type: "closed" as const, icon: "🚫" },
  { type: "info" as const, icon: "💡" },
  { type: "new" as const, icon: "📍" },
];

export const ReportSheet = memo(function ReportSheet({
  toilet,
  visible,
  onClose,
}: ReportSheetProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleOptionPress = (type: (typeof OPTIONS)[0]["type"]) => {
    openReport(type, toilet);
    setShowConfirm(true);
    // Auto-close after showing confirmation
    setTimeout(() => {
      setShowConfirm(false);
      onClose();
    }, 1500);
  };

  const handleClose = () => {
    setShowConfirm(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleClose}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {showConfirm ? (
            <View style={styles.confirmContainer}>
              <Text style={styles.confirmIcon}>✓</Text>
              <Text style={styles.confirmTitle}>{t("report.openingGithub")}</Text>
              <Text style={styles.confirmSub}>
                {t("report.openingGithubSub")}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.title}>
                {toilet ? t("report.title") : t("report.titleNew")}
              </Text>
              {toilet && (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {toilet.name} · {toilet.city}
                </Text>
              )}

              <View style={styles.options}>
                {OPTIONS.filter((o) =>
                  toilet ? o.type !== "new" : o.type === "new",
                ).map((o) => (
                  <TouchableOpacity
                    key={o.type}
                    style={styles.option}
                    onPress={() => handleOptionPress(o.type)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.optionIcon}>{o.icon}</Text>
                    <View style={styles.optionText}>
                      <Text style={styles.optionLabel}>{t(`report.${o.type}.label`)}</Text>
                      <Text style={styles.optionSub}>{t(`report.${o.type}.sub`)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleClose}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelText}>{t("action.cancel")}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d0d0d0",
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: 14,
    color: "#888",
    marginTop: 2,
  },
  options: {
    marginTop: 20,
    gap: 4,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  optionIcon: {
    fontSize: 24,
    width: 40,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  optionSub: {
    fontSize: 13,
    color: "#888",
    marginTop: 1,
  },
  cancelBtn: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 14,
    backgroundColor: "#f0f0f0",
    borderRadius: 24,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  confirmContainer: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  confirmIcon: {
    fontSize: 48,
    color: "#34a853",
    fontWeight: "700",
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  confirmSub: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
  },
});
