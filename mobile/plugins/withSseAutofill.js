const fs = require("fs");
const path = require("path");
const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
} = require("expo/config-plugins");

const KOTLIN_FILES = [
  "SseAutofillStore.kt",
  "SseAutofillService.kt",
  "SseAutofillAuthActivity.kt",
  "SseAutofillModule.kt",
  "SseAutofillPackage.kt",
];

function withAutofillFiles(config) {
  return withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const androidRoot = modConfig.modRequest.platformProjectRoot;
      const srcDir = path.join(projectRoot, "plugins", "autofill-android");

      const javaTargetDir = path.join(
        androidRoot,
        "app",
        "src",
        "main",
        "java",
        "com",
        "sse",
        "vault",
        "autofill"
      );
      fs.mkdirSync(javaTargetDir, { recursive: true });
      for (const file of KOTLIN_FILES) {
        fs.copyFileSync(path.join(srcDir, file), path.join(javaTargetDir, file));
      }

      const xmlTargetDir = path.join(androidRoot, "app", "src", "main", "res", "xml");
      fs.mkdirSync(xmlTargetDir, { recursive: true });
      fs.copyFileSync(
        path.join(srcDir, "sse_autofill_service.xml"),
        path.join(xmlTargetDir, "sse_autofill_service.xml")
      );

      const layoutTargetDir = path.join(androidRoot, "app", "src", "main", "res", "layout");
      fs.mkdirSync(layoutTargetDir, { recursive: true });
      fs.copyFileSync(
        path.join(srcDir, "sse_autofill_item.xml"),
        path.join(layoutTargetDir, "sse_autofill_item.xml")
      );

      return modConfig;
    },
  ]);
}

function withAutofillManifest(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    const app = manifest.application && manifest.application[0];
    if (!app) return modConfig;

    // 1. Register SseAutofillService
    app.service = app.service || [];
    const hasService = app.service.some(
      (s) => s.$ && s.$["android:name"] === ".autofill.SseAutofillService"
    );
    if (!hasService) {
      app.service.push({
        $: {
          "android:name": ".autofill.SseAutofillService",
          "android:label": "SSE Vault",
          "android:permission": "android.permission.BIND_AUTOFILL_SERVICE",
          "android:exported": "true",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name": "android.service.autofill.AutofillService",
                },
              },
            ],
          },
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.autofill",
              "android:resource": "@xml/sse_autofill_service",
            },
          },
        ],
      });
    }

    // 2. Register SseAutofillAuthActivity (Biometric prompt + searchable picker)
    app.activity = app.activity || [];
    const hasActivity = app.activity.some(
      (a) => a.$ && a.$["android:name"] === ".autofill.SseAutofillAuthActivity"
    );
    if (!hasActivity) {
      app.activity.push({
        $: {
          "android:name": ".autofill.SseAutofillAuthActivity",
          "android:exported": "false",
          "android:excludeFromRecents": "true",
          "android:theme": "@style/Theme.AppCompat.DayNight.NoActionBar",
        },
      });
    }

    return modConfig;
  });
}

function withAutofillGradle(config) {
  return withAppBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (!contents.includes("androidx.biometric:biometric")) {
      contents = contents.replace(
        /dependencies\s*\{/,
        'dependencies {\n    implementation("androidx.biometric:biometric:1.1.0")'
      );
    }
    modConfig.modResults.contents = contents;
    return modConfig;
  });
}

function withAutofillMainApplication(config) {
  return withMainApplication(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (!contents.includes("com.sse.vault.autofill.SseAutofillPackage")) {
      contents = contents.replace(
        /^(package\s+[^\n]+\n)/m,
        "$1import com.sse.vault.autofill.SseAutofillPackage\n"
      );
    }
    if (!contents.includes("SseAutofillPackage()")) {
      if (contents.includes("PackageList(this).packages.apply {")) {
        contents = contents.replace(
          "PackageList(this).packages.apply {",
          "PackageList(this).packages.apply {\n              add(SseAutofillPackage())"
        );
      } else if (contents.includes("PackageList(this).packages")) {
        contents = contents.replace(
          "PackageList(this).packages",
          "PackageList(this).packages.apply { add(SseAutofillPackage()) }"
        );
      }
    }
    modConfig.modResults.contents = contents;
    return modConfig;
  });
}

module.exports = function withSseAutofill(config) {
  config = withAutofillFiles(config);
  config = withAutofillManifest(config);
  config = withAutofillGradle(config);
  config = withAutofillMainApplication(config);
  return config;
};
