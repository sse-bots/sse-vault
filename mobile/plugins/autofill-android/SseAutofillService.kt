package com.sse.vault.autofill

import android.app.PendingIntent
import android.app.assist.AssistStructure
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.CancellationSignal
import android.service.autofill.AutofillService
import android.service.autofill.Dataset
import android.service.autofill.FillCallback
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.service.autofill.SaveCallback
import android.service.autofill.SaveInfo
import android.service.autofill.SaveRequest
import android.text.InputType
import android.view.View
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import androidx.annotation.RequiresApi
import com.sse.vault.R

data class ParsedAutofillForm(
    val webDomain: String?,
    val packageName: String?,
    val usernameId: AutofillId?,
    val passwordId: AutofillId?,
    val usernameValue: String,
    val passwordValue: String
) {
    fun targetIds(): Array<AutofillId> {
        val list = ArrayList<AutofillId>(2)
        if (usernameId != null) list.add(usernameId)
        if (passwordId != null) list.add(passwordId)
        return list.toTypedArray()
    }
}

@RequiresApi(Build.VERSION_CODES.O)
class SseAutofillService : AutofillService() {

    override fun onFillRequest(
        request: FillRequest,
        cancellationSignal: CancellationSignal,
        callback: FillCallback
    ) {
        try {
            val contexts = request.fillContexts
            if (contexts.isEmpty()) {
                callback.onSuccess(null)
                return
            }
            val structure = contexts[contexts.size - 1].structure
            val form = parseStructure(structure)

            // Never autofill SSE Vault itself
            if (form.packageName == packageName) {
                callback.onSuccess(null)
                return
            }
            val ids = form.targetIds()
            if (ids.isEmpty()) {
                callback.onSuccess(null)
                return
            }

            if (!SseAutofillStore.isSyncEnabled(this)) {
                callback.onSuccess(null)
                return
            }

            val allEntries = SseAutofillStore.loadEntries(this)
            val matches = SseAutofillStore.findMatches(allEntries, form.webDomain, form.packageName)

            val responseBuilder = FillResponse.Builder()

            // Register SaveInfo so Android prompts "Save to SSE Vault?" on manual logins
            addSaveInfo(responseBuilder, form)

            if (SseAutofillStore.isRequireAuth(this)) {
                // Require biometric / device credential unlock before revealing secrets
                val subtitle = when {
                    matches.size == 1 -> "Unlock to fill ${matches[0].displayTitle()}"
                    matches.size > 1 -> "Unlock to choose from ${matches.size} matching accounts"
                    allEntries.isNotEmpty() -> "Unlock & search ${allEntries.size} SSE Vault accounts"
                    else -> "Open SSE Vault to sync logins"
                }
                val presentation = buildRowPresentation(this, "SSE Vault", subtitle)
                val authIntent = Intent(this, SseAutofillAuthActivity::class.java).apply {
                    putExtra(SseAutofillAuthActivity.EXTRA_WEB_DOMAIN, form.webDomain ?: "")
                    putExtra(SseAutofillAuthActivity.EXTRA_PACKAGE_NAME, form.packageName ?: "")
                    putExtra(SseAutofillAuthActivity.EXTRA_USERNAME_ID, form.usernameId)
                    putExtra(SseAutofillAuthActivity.EXTRA_PASSWORD_ID, form.passwordId)
                }
                val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_CANCEL_CURRENT
                } else {
                    PendingIntent.FLAG_CANCEL_CURRENT
                }
                val sender = PendingIntent.getActivity(
                    this,
                    (System.currentTimeMillis() and 0x7FFFFFFF).toInt(),
                    authIntent,
                    flags
                ).intentSender

                @Suppress("DEPRECATION")
                responseBuilder.setAuthentication(ids, sender, presentation)
                callback.onSuccess(responseBuilder.build())
                return
            }

            // Direct autofill mode (Require Auth toggled OFF in SSE Vault Settings)
            var addedCount = 0
            for (entry in matches.take(8)) {
                val ds = buildDatasetForEntry(this, entry, form.usernameId, form.passwordId)
                if (ds != null) {
                    responseBuilder.addDataset(ds)
                    addedCount++
                }
            }

            // Always offer a "Search SSE Vault..." fallback item if entries exist
            if (allEntries.isNotEmpty()) {
                val searchDs = buildSearchFallbackDataset(this, form)
                if (searchDs != null) {
                    responseBuilder.addDataset(searchDs)
                    addedCount++
                }
            }

            callback.onSuccess(if (addedCount > 0 || form.passwordId != null) responseBuilder.build() else null)
        } catch (_: Exception) {
            callback.onSuccess(null)
        }
    }

    override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
        try {
            val contexts = request.fillContexts
            if (contexts.isNotEmpty()) {
                val structure = contexts[contexts.size - 1].structure
                val form = parseStructure(structure)
                if (form.packageName != packageName &&
                    (form.usernameValue.isNotBlank() || form.passwordValue.isNotBlank())
                ) {
                    SseAutofillStore.addPendingSave(
                        this,
                        form.webDomain,
                        form.packageName,
                        form.usernameValue,
                        form.passwordValue
                    )
                }
            }
            callback.onSuccess()
        } catch (e: Exception) {
            callback.onFailure(e.message ?: "Could not save credentials to SSE Vault.")
        }
    }

    companion object {
        fun buildRowPresentation(context: Context, title: String, subtitle: String): RemoteViews {
            val rv = RemoteViews(context.packageName, R.layout.sse_autofill_item)
            rv.setTextViewText(R.id.sse_autofill_title, title)
            rv.setTextViewText(R.id.sse_autofill_subtitle, subtitle)
            return rv
        }

        @Suppress("DEPRECATION")
        fun buildDatasetForEntry(
            context: Context,
            entry: AutofillEntry,
            usernameId: AutofillId?,
            passwordId: AutofillId?
        ): Dataset? {
            val presentation = buildRowPresentation(
                context,
                entry.displayTitle(),
                entry.displaySubtitle()
            )
            val builder = Dataset.Builder(presentation)
            var hasValue = false
            val loginVal = entry.primaryLogin()
            if (usernameId != null && loginVal.isNotBlank()) {
                builder.setValue(usernameId, AutofillValue.forText(loginVal), presentation)
                hasValue = true
            }
            if (passwordId != null && entry.password.isNotBlank()) {
                builder.setValue(passwordId, AutofillValue.forText(entry.password), presentation)
                hasValue = true
            }
            return if (hasValue) builder.build() else null
        }

        @Suppress("DEPRECATION")
        fun buildSearchFallbackDataset(
            context: Context,
            form: ParsedAutofillForm
        ): Dataset? {
            val presentation = buildRowPresentation(
                context,
                "Search SSE Vault…",
                "Pick any saved login from your vault"
            )
            val intent = Intent(context, SseAutofillAuthActivity::class.java).apply {
                putExtra(SseAutofillAuthActivity.EXTRA_WEB_DOMAIN, form.webDomain ?: "")
                putExtra(SseAutofillAuthActivity.EXTRA_PACKAGE_NAME, form.packageName ?: "")
                putExtra(SseAutofillAuthActivity.EXTRA_USERNAME_ID, form.usernameId)
                putExtra(SseAutofillAuthActivity.EXTRA_PASSWORD_ID, form.passwordId)
                putExtra(SseAutofillAuthActivity.EXTRA_FORCE_PICKER, true)
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_CANCEL_CURRENT
            } else {
                PendingIntent.FLAG_CANCEL_CURRENT
            }
            val sender = PendingIntent.getActivity(
                context,
                ((System.currentTimeMillis() + 991) and 0x7FFFFFFF).toInt(),
                intent,
                flags
            ).intentSender

            val builder = Dataset.Builder(presentation)
            var added = false
            if (form.usernameId != null) {
                builder.setValue(form.usernameId, AutofillValue.forText(""), presentation)
                added = true
            }
            if (form.passwordId != null) {
                builder.setValue(form.passwordId, AutofillValue.forText(""), presentation)
                added = true
            }
            if (!added) return null
            builder.setAuthentication(sender)
            return builder.build()
        }

        fun addSaveInfo(responseBuilder: FillResponse.Builder, form: ParsedAutofillForm) {
            val passId = form.passwordId ?: return
            val requiredIds = arrayOf(passId)
            val saveBuilder = SaveInfo.Builder(SaveInfo.SAVE_DATA_TYPE_PASSWORD, requiredIds)
            if (form.usernameId != null) {
                saveBuilder.setOptionalIds(arrayOf(form.usernameId))
            }
            responseBuilder.setSaveInfo(saveBuilder.build())
        }

        fun parseStructure(structure: AssistStructure): ParsedAutofillForm {
            var webDomain: String? = null
            var usernameId: AutofillId? = null
            var passwordId: AutofillId? = null
            var usernameValue = ""
            var passwordValue = ""
            val pkgName = structure.activityComponent?.packageName

            fun walk(node: AssistStructure.ViewNode) {
                val dom = node.webDomain
                if (!dom.isNullOrBlank() && webDomain == null) {
                    webDomain = dom
                }

                val aid = node.autofillId
                if (aid != null && node.visibility == View.VISIBLE) {
                    val hints = node.autofillHints?.map { it.lowercase() } ?: emptyList()
                    val inputType = node.inputType
                    val variation = inputType and InputType.TYPE_MASK_VARIATION
                    val htmlTag = node.htmlInfo?.tag?.lowercase() ?: ""
                    val htmlAttrs = mutableMapOf<String, String>()
                    node.htmlInfo?.attributes?.forEach { pair ->
                        htmlAttrs[pair.first.lowercase()] = (pair.second ?: "").lowercase()
                    }
                    val htmlType = htmlAttrs["type"] ?: ""
                    val htmlAutocomplete = htmlAttrs["autocomplete"] ?: ""
                    val htmlName = htmlAttrs["name"] ?: ""
                    val idEntry = (node.idEntry ?: "").lowercase()
                    val hintText = (node.hint ?: "").lowercase()
                    val combined = "$idEntry $hintText $htmlName $htmlAutocomplete"

                    val isPassword =
                        hints.any { it.contains("password") } ||
                        htmlType == "password" ||
                        htmlAutocomplete.contains("password") ||
                        variation == InputType.TYPE_TEXT_VARIATION_PASSWORD ||
                        variation == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD ||
                        variation == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD ||
                        (isEditableNode(node, htmlTag, htmlType) &&
                            (idEntry.contains("password") || idEntry.contains("passwd") || hintText.contains("password")))

                    val isUsername = !isPassword && (
                        hints.any { it.contains("username") || it.contains("email") || it.contains("phone") } ||
                        htmlType == "email" ||
                        htmlAutocomplete.contains("username") ||
                        htmlAutocomplete.contains("email") ||
                        variation == InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS ||
                        variation == InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS ||
                        (isEditableNode(node, htmlTag, htmlType) && (
                            combined.contains("email") ||
                            combined.contains("user") ||
                            combined.contains("login") ||
                            combined.contains("account") ||
                            combined.contains("identifier")
                        ))
                    )

                    val currentText = node.autofillValue?.takeIf { it.isText }?.textValue?.toString()
                        ?: node.text?.toString()
                        ?: ""

                    if (isPassword && passwordId == null) {
                        passwordId = aid
                        if (currentText.isNotBlank()) passwordValue = currentText
                    } else if (isUsername && usernameId == null) {
                        usernameId = aid
                        if (currentText.isNotBlank()) usernameValue = currentText
                    }
                }

                for (i in 0 until node.childCount) {
                    walk(node.getChildAt(i))
                }
            }

            for (i in 0 until structure.windowNodeCount) {
                val root = structure.getWindowNodeAt(i).rootViewNode
                if (root != null) walk(root)
            }

            return ParsedAutofillForm(
                webDomain = webDomain,
                packageName = pkgName,
                usernameId = usernameId,
                passwordId = passwordId,
                usernameValue = usernameValue,
                passwordValue = passwordValue
            )
        }

        private fun isEditableNode(
            node: AssistStructure.ViewNode,
            htmlTag: String,
            htmlType: String
        ): Boolean {
            if (htmlTag == "input") {
                return htmlType.isBlank() ||
                    htmlType == "text" ||
                    htmlType == "email" ||
                    htmlType == "password" ||
                    htmlType == "tel"
            }
            val cls = node.className ?: ""
            return cls.contains("EditText", ignoreCase = true) ||
                cls.contains("AutoCompleteTextView", ignoreCase = true) ||
                node.autofillType == View.AUTOFILL_TYPE_TEXT
        }
    }
}
