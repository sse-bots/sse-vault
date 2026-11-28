import React, { useState } from "react";
import { Alert, Modal, Pressable, Text, View } from "react-native";
import { CameraView, scanFromURLAsync, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import { Button, IconButton } from "./ui";
import { c, radius } from "./theme";

export interface ScannedTotpResult {
  secretOrUri: string;
  issuer?: string;
  account?: string;
}

export function extractMobileTotpFromQr(raw: string): ScannedTotpResult | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase().startsWith("otpauth://totp/")) {
    const q = trimmed.split("?")[1] || "";
    const params: Record<string, string> = {};
    q.split("&").forEach((kv) => {
      const [k, v] = kv.split("=");
      if (k) params[k.toLowerCase()] = decodeURIComponent(v || "");
    });
    const secret = (params.secret || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
    if (secret.length < 8) return null;
    const pathPart = decodeURIComponent(
      (trimmed.split("?")[0] || "").replace(/^otpauth:\/\/totp\/+/i, "")
    );
    const parts = pathPart.split(":");
    const issuer =
      (params.issuer || "").trim() || (parts.length > 1 ? parts[0].trim() : "");
    const account =
      parts.length > 1 ? parts.slice(1).join(":").trim() : pathPart.trim();
    return {
      secretOrUri: trimmed,
      issuer: issuer || undefined,
      account: account || undefined,
    };
  }
  const clean = trimmed.toUpperCase().replace(/[^A-Z2-7]/g, "");
  if (clean.length >= 16) return { secretOrUri: clean };
  return null;
}

/**
 * Picks a QR screenshot from Android gallery and scans it locally on-device
 * using expo-camera's native MLKit/ZXing barcode scanner — never uploaded!
 */
export async function pickAndDecodeQrImage(): Promise<ScannedTotpResult | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 1,
  });
  if (res.canceled || !res.assets?.[0]?.uri) return null;
  const uri = res.assets[0].uri;
  try {
    const scanned = await scanFromURLAsync(uri, ["qr"]);
    const raw = scanned?.[0]?.data || "";
    if (!raw) {
      Alert.alert(
        "No QR Found",
        "No QR code was detected in that image. Try cropping closer to the QR code."
      );
      return null;
    }
    const parsed = extractMobileTotpFromQr(raw);
    if (!parsed) {
      Alert.alert(
        "Not a TOTP QR",
        "That QR code does not contain a valid authenticator secret or otpauth:// link."
      );
      return null;
    }
    return parsed;
  } finally {
    if (uri.startsWith(FileSystem.cacheDirectory || "___")) {
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
  }
}

export function QrScannerModal({
  visible,
  onClose,
  onScanned,
}: {
  visible: boolean;
  onClose: () => void;
  onScanned: (res: ScannedTotpResult) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [handled, setHandled] = useState(false);

  const handleBarcode = ({ data }: { data: string }) => {
    if (handled) return;
    const parsed = extractMobileTotpFromQr(data);
    if (!parsed) {
      setHandled(true);
      Alert.alert("Not a 2FA QR Code", "Point the camera at an authenticator QR code.", [
        { text: "Try Again", onPress: () => setHandled(false) },
      ]);
      return;
    }
    setHandled(true);
    onScanned(parsed);
    setTimeout(() => setHandled(false), 400);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 44,
            paddingHorizontal: 12,
            paddingBottom: 12,
            backgroundColor: c.card,
          }}
        >
          <IconButton icon="close" onPress={onClose} label="Close" />
          <Text style={{ color: c.text, fontSize: 16, fontWeight: "800" }}>
            Scan Authenticator QR
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {!permission?.granted ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              backgroundColor: c.bg,
            }}
          >
            <Ionicons name="camera-outline" size={48} color={c.accent} />
            <Text
              style={{
                color: c.text,
                fontSize: 18,
                fontWeight: "800",
                marginTop: 14,
              }}
            >
              Camera Permission Needed
            </Text>
            <Text
              style={{
                color: c.muted,
                textAlign: "center",
                marginTop: 6,
                marginBottom: 20,
                fontSize: 13,
              }}
            >
              Allow camera access to scan 2FA QR codes directly into SSE Vault.
            </Text>
            <Button
              title="Grant Camera Permission"
              icon="camera"
              onPress={() => void requestPermission()}
            />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={handled ? undefined : handleBarcode}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                inset: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 240,
                  height: 240,
                  borderRadius: radius.xl,
                  borderWidth: 3,
                  borderColor: c.accent,
                  backgroundColor: "rgba(0,0,0,0.08)",
                }}
              />
              <Text
                style={{
                  color: "#fff",
                  marginTop: 18,
                  fontWeight: "700",
                  fontSize: 13,
                  backgroundColor: "rgba(0,0,0,0.65)",
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 999,
                }}
              >
                Align 2FA QR code inside the frame
              </Text>
            </View>
            <View style={{ padding: 16, backgroundColor: c.card }}>
              <Pressable
                onPress={async () => {
                  const res = await pickAndDecodeQrImage();
                  if (res) {
                    onScanned(res);
                    onClose();
                  }
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  paddingVertical: 12,
                  borderRadius: radius.md,
                  backgroundColor: c.card2,
                  borderWidth: 1,
                  borderColor: c.border,
                }}
              >
                <Ionicons name="image-outline" size={18} color={c.accentLabel} />
                <Text style={{ color: c.text, fontWeight: "800", fontSize: 13 }}>
                  Upload QR Screenshot from Gallery Instead
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}
