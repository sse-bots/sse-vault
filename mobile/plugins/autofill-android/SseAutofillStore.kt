package com.sse.vault.autofill

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class AutofillEntry(
    val id: String,
    val domainKey: String,
    val appName: String,
    val label: String,
    val email: String,
    val username: String,
    val password: String,
    val authType: String,
    val oauthProvider: String
) {
    fun primaryLogin(): String {
        if (username.isNotBlank()) return username
        if (email.isNotBlank()) return email
        return label
    }

    fun displayTitle(): String {
        if (label.isNotBlank() && !label.equals(appName, ignoreCase = true)) {
            return "$appName · $label"
        }
        return appName.ifBlank { domainKey.ifBlank { "SSE Vault" } }
    }

    fun displaySubtitle(): String {
        if (authType == "oauth") {
            val prov = oauthProvider.ifBlank { "OAuth" }
            val who = email.ifBlank { username }
            return if (who.isNotBlank()) "$prov · $who" else "Sign in with $prov"
        }
        return primaryLogin().ifBlank { domainKey }
    }
}

object SseAutofillStore {
    private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
    private const val KEY_ALIAS = "sse_vault_autofill_aes_key_v1"
    private const val INDEX_FILE = "sse_autofill_index.enc"
    private const val PENDING_FILE = "sse_autofill_pending_save.enc"
    private const val PREFS_NAME = "sse_autofill_prefs"
    private const val KEY_SYNC_ENABLED = "sync_enabled"
    private const val KEY_REQUIRE_AUTH = "require_auth"

    private val BROWSER_PACKAGES = setOf(
        "com.android.chrome",
        "com.chrome.beta",
        "com.chrome.dev",
        "com.chrome.canary",
        "org.mozilla.firefox",
        "org.mozilla.firefox_beta",
        "org.mozilla.fenix",
        "org.mozilla.focus",
        "com.brave.browser",
        "com.microsoft.emmx",
        "com.opera.browser",
        "com.opera.mini.native",
        "com.opera.gx",
        "com.sec.android.app.sbrowser",
        "com.duckduckgo.mobile.android",
        "com.vivaldi.browser",
        "com.kiwibrowser.browser",
        "com.ecosia.android"
    )

    private val PACKAGE_DOMAIN_MAP = mapOf(
        "com.github.android" to "github.com",
        "com.discord" to "discord.com",
        "com.instagram.android" to "instagram.com",
        "com.twitter.android" to "x.com",
        "com.reddit.frontpage" to "reddit.com",
        "com.facebook.katana" to "facebook.com",
        "com.facebook.orca" to "facebook.com",
        "com.whatsapp" to "whatsapp.com",
        "org.telegram.messenger" to "telegram.org",
        "com.linkedin.android" to "linkedin.com",
        "com.spotify.music" to "spotify.com",
        "com.netflix.mediaclient" to "netflix.com",
        "com.amazon.mShop.android.shopping" to "amazon.com",
        "in.amazon.mShop.android.shopping" to "amazon.in",
        "com.paypal.android.p2pmobile" to "paypal.com",
        "com.valvesoftware.android.steam.community" to "steampowered.com",
        "tv.twitch.android.app" to "twitch.tv",
        "com.openai.chatgpt" to "chatgpt.com",
        "com.anthropic.claude" to "claude.ai",
        "com.notion.id" to "notion.so",
        "com.figma.mirror" to "figma.com",
        "com.microsoft.office.outlook" to "microsoft.com",
        "com.microsoft.teams" to "microsoft.com",
        "com.google.android.gm" to "google.com",
        "com.google.android.youtube" to "youtube.com",
        "com.mojang.minecraftpe" to "minecraft.net",
        "com.plarium.mechlegion" to "plarium.com"
    )

    private val GENERIC_PKG_SEGMENTS = setOf(
        "com", "org", "net", "io", "in", "co", "app", "android", "mobile",
        "client", "official", "free", "pro", "lite", "beta", "dev", "www"
    )

    fun isSyncEnabled(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_SYNC_ENABLED, true)
    }

    fun isRequireAuth(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_REQUIRE_AUTH, true)
    }

    fun setPrefs(context: Context, syncEnabled: Boolean, requireAuth: Boolean) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putBoolean(KEY_SYNC_ENABLED, syncEnabled)
            .putBoolean(KEY_REQUIRE_AUTH, requireAuth)
            .apply()
        if (!syncEnabled) {
            clearEntries(context)
        }
    }

    private fun getOrCreateKey(): SecretKey {
        val ks = KeyStore.getInstance(KEYSTORE_PROVIDER)
        ks.load(null)
        val existing = ks.getKey(KEY_ALIAS, null)
        if (existing is SecretKey) return existing

        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER)
        val spec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()
        gen.init(spec)
        return gen.generateKey()
    }

    private fun writeEncrypted(context: Context, fileName: String, plaintext: String) {
        val key = getOrCreateKey()
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key)
        val iv = cipher.iv
        val ciphertext = cipher.doFinal(plaintext.toByteArray(StandardCharsets.UTF_8))
        val envelope = JSONObject().apply {
            put("v", 1)
            put("iv", Base64.encodeToString(iv, Base64.NO_WRAP))
            put("ct", Base64.encodeToString(ciphertext, Base64.NO_WRAP))
        }
        File(context.filesDir, fileName).writeText(envelope.toString(), StandardCharsets.UTF_8)
    }

    private fun readEncrypted(context: Context, fileName: String): String? {
        val file = File(context.filesDir, fileName)
        if (!file.exists()) return null
        return try {
            val envelope = JSONObject(file.readText(StandardCharsets.UTF_8))
            val iv = Base64.decode(envelope.getString("iv"), Base64.NO_WRAP)
            val ct = Base64.decode(envelope.getString("ct"), Base64.NO_WRAP)
            val key = getOrCreateKey()
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, iv))
            String(cipher.doFinal(ct), StandardCharsets.UTF_8)
        } catch (_: Exception) {
            null
        }
    }

    fun saveEntriesJson(context: Context, jsonArrayString: String): Int {
        if (!isSyncEnabled(context)) {
            clearEntries(context)
            return 0
        }
        val arr = JSONArray(jsonArrayString)
        writeEncrypted(context, INDEX_FILE, arr.toString())
        return arr.length()
    }

    fun loadEntries(context: Context): List<AutofillEntry> {
        if (!isSyncEnabled(context)) return emptyList()
        val raw = readEncrypted(context, INDEX_FILE) ?: return emptyList()
        return try {
            val arr = JSONArray(raw)
            val out = ArrayList<AutofillEntry>(arr.length())
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                out.add(
                    AutofillEntry(
                        id = o.optString("id", ""),
                        domainKey = o.optString("domainKey", "").lowercase().trim(),
                        appName = o.optString("appName", "").trim(),
                        label = o.optString("label", "").trim(),
                        email = o.optString("email", "").trim(),
                        username = o.optString("username", "").trim(),
                        password = o.optString("password", ""),
                        authType = o.optString("authType", "password").trim(),
                        oauthProvider = o.optString("oauthProvider", "").trim()
                    )
                )
            }
            out
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun clearEntries(context: Context) {
        try {
            File(context.filesDir, INDEX_FILE).delete()
        } catch (_: Exception) {
        }
    }

    fun addPendingSave(
        context: Context,
        webDomain: String?,
        packageName: String?,
        username: String,
        password: String
    ) {
        if (username.isBlank() && password.isBlank()) return
        val existingRaw = readEncrypted(context, PENDING_FILE)
        val arr = try {
            if (existingRaw != null) JSONArray(existingRaw) else JSONArray()
        } catch (_: Exception) {
            JSONArray()
        }
        val item = JSONObject().apply {
            put("webDomain", webDomain ?: "")
            put("packageName", packageName ?: "")
            put("username", username)
            put("password", password)
            put("savedAt", System.currentTimeMillis())
        }
        // Keep last 10 pending saves
        val trimmed = JSONArray()
        val start = maxOf(0, arr.length() - 9)
        for (i in start until arr.length()) {
            trimmed.put(arr.get(i))
        }
        trimmed.put(item)
        writeEncrypted(context, PENDING_FILE, trimmed.toString())
    }

    fun getPendingSavesJson(context: Context): String {
        return readEncrypted(context, PENDING_FILE) ?: "[]"
    }

    fun clearPendingSaves(context: Context) {
        try {
            File(context.filesDir, PENDING_FILE).delete()
        } catch (_: Exception) {
        }
    }

    fun normalizeRootDomain(raw: String?): String {
        if (raw.isNullOrBlank()) return ""
        var host = raw.trim().lowercase()
        host = host.removePrefix("https://").removePrefix("http://")
        host = host.substringBefore("/").substringBefore(":").removePrefix("www.")
        val parts = host.split(".").filter { it.isNotBlank() }
        if (parts.size <= 2) return parts.joinToString(".")
        val lastTwo = "${parts[parts.size - 2]}.${parts[parts.size - 1]}"
        val multiPartTlds = setOf(
            "co.in", "org.in", "co.uk", "org.uk", "com.au", "com.br", "co.jp", "vercel.app",
            "netlify.app", "onrender.com", "pages.dev", "web.app", "herokuapp.com"
        )
        return if (multiPartTlds.contains(lastTwo) && parts.size >= 3) {
            "${parts[parts.size - 3]}.$lastTwo"
        } else {
            lastTwo
        }
    }

    fun findMatches(
        entries: List<AutofillEntry>,
        webDomain: String?,
        packageName: String?
    ): List<AutofillEntry> {
        if (entries.isEmpty()) return emptyList()
        val targetDomain = normalizeRootDomain(webDomain)
        val pkg = (packageName ?: "").lowercase().trim()
        val isBrowser = BROWSER_PACKAGES.contains(pkg)

        // 1. Direct website domain match (Chrome, Firefox, Brave, WebViews)
        if (targetDomain.isNotBlank()) {
            val exact = entries.filter { e ->
                val eDom = normalizeRootDomain(e.domainKey)
                eDom.isNotBlank() && (
                    eDom == targetDomain ||
                    e.domainKey == webDomain?.lowercase()?.trim() ||
                    targetDomain.endsWith(".$eDom")
                )
            }
            if (exact.isNotEmpty()) return exact
        }

        // 2. Native Android app package matching (skip browser packages)
        if (pkg.isNotBlank() && !isBrowser) {
            val mappedDomain = PACKAGE_DOMAIN_MAP[pkg]
            if (mappedDomain != null) {
                val mappedMatches = entries.filter {
                    normalizeRootDomain(it.domainKey) == normalizeRootDomain(mappedDomain)
                }
                if (mappedMatches.isNotEmpty()) return mappedMatches
            }

            val tokens = pkg.split(".")
                .map { it.trim() }
                .filter { it.length >= 3 && !GENERIC_PKG_SEGMENTS.contains(it) }

            if (tokens.isNotEmpty()) {
                val pkgMatches = entries.filter { e ->
                    val domBase = normalizeRootDomain(e.domainKey).substringBefore(".")
                    val appNorm = e.appName.lowercase().replace(Regex("[^a-z0-9]"), "")
                    tokens.any { tok ->
                        (domBase.length >= 3 && (domBase == tok || tok.contains(domBase) || domBase.contains(tok))) ||
                        (appNorm.length >= 3 && (appNorm == tok || tok.contains(appNorm)))
                    }
                }
                if (pkgMatches.isNotEmpty()) return pkgMatches
            }
        }

        return emptyList()
    }
}
