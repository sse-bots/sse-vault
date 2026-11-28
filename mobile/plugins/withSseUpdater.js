const fs = require("fs");
const path = require("path");
const {
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
} = require("expo/config-plugins");

const KOTLIN_FILES = ["SseUpdaterModule.kt", "SseUpdaterPackage.kt"];

function withUpdaterFiles(config) {
  return withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const androidRoot = modConfig.modRequest.platformProjectRoot;
      const srcDir = path.join(projectRoot, "plugins", "updater-android");

      const javaTargetDir = path.join(
        androidRoot,
        "app",
        "src",
        "main",
        "java",
        "com",
        "sse",
        "vault",
        "updater"
      );
      fs.mkdirSync(javaTargetDir, { recursive: true });
      for (const file of KOTLIN_FILES) {
        fs.copyFileSync(path.join(srcDir, file), path.join(javaTargetDir, file));
      }

      const xmlTargetDir = path.join(androidRoot, "app", "src", "main", "res", "xml");
      fs.mkdirSync(xmlTargetDir, { recursive: true });
      fs.copyFileSync(
        path.join(srcDir, "sse_updater_paths.xml"),
        path.join(xmlTargetDir, "sse_updater_paths.xml")
      );

      return modConfig;
    },
  ]);
}

function withUpdaterManifest(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;

    // 1. Ensure REQUEST_INSTALL_PACKAGES permission
    manifest["uses-permission"] = manifest["uses-permission"] || [];
    const hasPerm = manifest["uses-permission"].some(
      (p) => p.$ && p.$["android:name"] === "android.permission.REQUEST_INSTALL_PACKAGES"
    );
    if (!hasPerm) {
      manifest["uses-permission"].push({
        $: { "android:name": "android.permission.REQUEST_INSTALL_PACKAGES" },
      });
    }

    // 2. Register dedicated FileProvider for APK installs (unique authority avoids conflicts)
    const app = manifest.application && manifest.application[0];
    if (!app) return modConfig;
    app.provider = app.provider || [];
    const authority = "${applicationId}.sseupdater.provider";
    const hasProvider = app.provider.some(
      (p) => p.$ && p.$["android:authorities"] === authority
    );
    if (!hasProvider) {
      app.provider.push({
        $: {
          "android:name": "androidx.core.content.FileProvider",
          "android:authorities": authority,
          "android:exported": "false",
          "android:grantUriPermissions": "true",
        },
        "meta-data": [
          {
            $: {
              "android:name": "android.support.FILE_PROVIDER_PATHS",
              "android:resource": "@xml/sse_updater_paths",
            },
          },
        ],
      });
    }

    return modConfig;
  });
}

function withUpdaterMainApplication(config) {
  return withMainApplication(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (!contents.includes("com.sse.vault.updater.SseUpdaterPackage")) {
      contents = contents.replace(
        /^(package\s+[^\n]+\n)/m,
        "$1import com.sse.vault.updater.SseUpdaterPackage\n"
      );
    }
    if (!contents.includes("SseUpdaterPackage()")) {
      if (/\breturn\s+packages\b/.test(contents)) {
        contents = contents.replace(
          /([ \t]*)return\s+packages\b/,
          "$1packages.add(SseUpdaterPackage())\n$1return packages"
        );
      } else if (contents.includes("PackageList(this).packages.apply {")) {
        contents = contents.replace(
          "PackageList(this).packages.apply {",
          "PackageList(this).packages.apply {\n              add(SseUpdaterPackage())\n"
        );
      } else if (contents.includes("PackageList(this).packages")) {
        contents = contents.replace(
          "PackageList(this).packages",
          "PackageList(this).packages.apply {\n              add(SseUpdaterPackage())\n            }"
        );
      }
    }
    modConfig.modResults.contents = contents;
    return modConfig;
  });
}

module.exports = function withSseUpdater(config) {
  config = withUpdaterFiles(config);
  config = withUpdaterManifest(config);
  config = withUpdaterMainApplication(config);
  return config;
};
