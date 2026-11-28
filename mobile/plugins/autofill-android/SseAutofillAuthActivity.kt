package com.sse.vault.autofill

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.service.autofill.FillResponse
import android.text.Editable
import android.text.TextWatcher
import android.util.TypedValue
import android.view.Gravity
import android.view.ViewGroup
import android.view.autofill.AutofillId
import android.view.autofill.AutofillManager
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.annotation.RequiresApi
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

@RequiresApi(Build.VERSION_CODES.O)
class SseAutofillAuthActivity : FragmentActivity() {

    private var webDomain: String = ""
    private var clientPkg: String = ""
    private var usernameId: AutofillId? = null
    private var passwordId: AutofillId? = null
    private var forcePicker: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webDomain = intent.getStringExtra(EXTRA_WEB_DOMAIN) ?: ""
        clientPkg = intent.getStringExtra(EXTRA_PACKAGE_NAME) ?: ""
        forcePicker = intent.getBooleanExtra(EXTRA_FORCE_PICKER, false)
        usernameId = getParcelableExtraCompat(intent, EXTRA_USERNAME_ID)
        passwordId = getParcelableExtraCompat(intent, EXTRA_PASSWORD_ID)

        if (!SseAutofillStore.isRequireAuth(this)) {
            onAuthenticated()
            return
        }

        val authenticators =
            BiometricManager.Authenticators.BIOMETRIC_WEAK or
                BiometricManager.Authenticators.DEVICE_CREDENTIAL
        val bm = BiometricManager.from(this)
        val canAuth = bm.canAuthenticate(authenticators)

        if (canAuth != BiometricManager.BIOMETRIC_SUCCESS) {
            // Device has no biometric or screen lock enrolled — allow direct picker
            onAuthenticated()
            return
        }

        val executor = ContextCompat.getMainExecutor(this)
        val prompt = BiometricPrompt(
            this,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    onAuthenticated()
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    setResult(Activity.RESULT_CANCELED)
                    finish()
                }
            }
        )

        val subtitle = when {
            webDomain.isNotBlank() -> "Unlock to fill login for $webDomain"
            clientPkg.isNotBlank() -> "Unlock to fill login for $clientPkg"
            else -> "Unlock SSE Vault to autofill"
        }

        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle("SSE Vault Autofill")
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(authenticators)
            .build()

        prompt.authenticate(info)
    }

    private fun onAuthenticated() {
        val allEntries = SseAutofillStore.loadEntries(this)
        val matches = SseAutofillStore.findMatches(allEntries, webDomain, clientPkg)

        // If we have direct matches and user did not ask for full search picker, return FillResponse
        if (!forcePicker && matches.isNotEmpty()) {
            val responseBuilder = FillResponse.Builder()
            var count = 0
            for (entry in matches.take(8)) {
                val ds = SseAutofillService.buildDatasetForEntry(this, entry, usernameId, passwordId)
                if (ds != null) {
                    responseBuilder.addDataset(ds)
                    count++
                }
            }
            if (count > 0) {
                val form = ParsedAutofillForm(webDomain, clientPkg, usernameId, passwordId, "", "")
                SseAutofillService.addSaveInfo(responseBuilder, form)
                val reply = Intent().putExtra(
                    AutofillManager.EXTRA_AUTHENTICATION_RESULT,
                    responseBuilder.build()
                )
                setResult(Activity.RESULT_OK, reply)
                finish()
                return
            }
        }

        // Otherwise show clean native dark-themed searchable picker for all SSE Vault logins
        showSearchablePicker(allEntries)
    }

    private fun showSearchablePicker(allEntries: List<AutofillEntry>) {
        val dp = { v: Int ->
            TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                v.toFloat(),
                resources.displayMetrics
            ).toInt()
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#09090b"))
            setPadding(dp(16), dp(42), dp(16), dp(16))
        }

        val headerRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 0, 0, dp(12))
        }

        val titleView = TextView(this).apply {
            text = "SSE Vault Autofill"
            setTextColor(Color.parseColor("#fafafa"))
            textSize = 20f
            setTypeface(null, Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }

        val cancelBtn = TextView(this).apply {
            text = "Cancel"
            setTextColor(Color.parseColor("#f59e0b"))
            textSize = 14f
            setTypeface(null, Typeface.BOLD)
            setPadding(dp(12), dp(8), dp(4), dp(8))
            setOnClickListener {
                setResult(Activity.RESULT_CANCELED)
                finish()
            }
        }

        headerRow.addView(titleView)
        headerRow.addView(cancelBtn)
        root.addView(headerRow)

        val searchBox = EditText(this).apply {
            hint = "Search app, domain, email or username…"
            setHintTextColor(Color.parseColor("#71717a"))
            setTextColor(Color.parseColor("#fafafa"))
            setBackgroundColor(Color.parseColor("#18181d"))
            setPadding(dp(14), dp(12), dp(14), dp(12))
            textSize = 14f
            isSingleLine = true
        }
        root.addView(searchBox)

        val scroll = ScrollView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f
            ).apply { topMargin = dp(12) }
        }
        val listContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        scroll.addView(listContainer)
        root.addView(scroll)

        fun render(query: String) {
            listContainer.removeAllViews()
            val q = query.trim().lowercase()
            val filtered = if (q.isEmpty()) {
                allEntries
            } else {
                allEntries.filter {
                    it.appName.lowercase().contains(q) ||
                        it.domainKey.lowercase().contains(q) ||
                        it.label.lowercase().contains(q) ||
                        it.email.lowercase().contains(q) ||
                        it.username.lowercase().contains(q)
                }
            }

            if (filtered.isEmpty()) {
                val empty = TextView(this).apply {
                    text = if (allEntries.isEmpty()) {
                        "No logins synced to Autofill yet. Open SSE Vault and unlock once to sync."
                    } else {
                        "No matching logins found."
                    }
                    setTextColor(Color.parseColor("#a1a1aa"))
                    textSize = 14f
                    setPadding(dp(8), dp(24), dp(8), dp(24))
                }
                listContainer.addView(empty)
                return
            }

            for (entry in filtered.take(50)) {
                val row = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    setBackgroundColor(Color.parseColor("#111115"))
                    setPadding(dp(14), dp(12), dp(14), dp(12))
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    ).apply { bottomMargin = dp(8) }
                    setOnClickListener {
                        val ds = SseAutofillService.buildDatasetForEntry(
                            this@SseAutofillAuthActivity,
                            entry,
                            usernameId,
                            passwordId
                        )
                        if (ds != null) {
                            val reply = Intent().putExtra(
                                AutofillManager.EXTRA_AUTHENTICATION_RESULT,
                                ds
                            )
                            setResult(Activity.RESULT_OK, reply)
                        } else {
                            setResult(Activity.RESULT_CANCELED)
                        }
                        finish()
                    }
                }
                val t1 = TextView(this).apply {
                    text = entry.displayTitle()
                    setTextColor(Color.parseColor("#fafafa"))
                    textSize = 15f
                    setTypeface(null, Typeface.BOLD)
                }
                val t2 = TextView(this).apply {
                    text = entry.displaySubtitle()
                    setTextColor(Color.parseColor("#a1a1aa"))
                    textSize = 12f
                }
                row.addView(t1)
                row.addView(t2)
                listContainer.addView(row)
            }
        }

        searchBox.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                render(s?.toString() ?: "")
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        render("")
        setContentView(root)
    }

    @Suppress("DEPRECATION")
    private fun getParcelableExtraCompat(intent: Intent, key: String): AutofillId? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(key, AutofillId::class.java)
        } else {
            intent.getParcelableExtra(key)
        }
    }

    companion object {
        const val EXTRA_WEB_DOMAIN = "sse_web_domain"
        const val EXTRA_PACKAGE_NAME = "sse_package_name"
        const val EXTRA_USERNAME_ID = "sse_username_id"
        const val EXTRA_PASSWORD_ID = "sse_password_id"
        const val EXTRA_FORCE_PICKER = "sse_force_picker"
    }
}
