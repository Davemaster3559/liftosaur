package com.devfit.app.timer

import android.content.Context

object RestCueStore {
    private fun prefs(context: Context) = context.applicationContext.getSharedPreferences("DevFitRestEvents", Context.MODE_PRIVATE)
    @Synchronized fun scheduled(context: Context, eventId: String, deadline: Long, revision: Long): Boolean {
        val token = "$eventId:$revision:$deadline"
        val store = prefs(context)
        return (store.getStringSet("tokens", emptySet()) ?: emptySet()).contains(token) && !store.getBoolean("cancelled:$token", false)
    }
    @Synchronized fun superseded(context: Context, eventId: String, deadline: Long, revision: Long): Boolean {
        val store = prefs(context)
        if (store.getString("eventId", null) != eventId) return false
        val latest = store.getLong("revision", 0)
        return revision < latest || (revision == latest && (deadline != store.getLong("deadline", 0) || store.getBoolean("cancelled:$eventId:$revision:$deadline", false)))
    }
    @Synchronized fun matches(context: Context, eventId: String, deadline: Long, revision: Long): Boolean {
        val store = prefs(context)
        return store.getString("active", null) == "$eventId:$revision:$deadline" && System.currentTimeMillis() < deadline
    }
    fun payload(context: Context): String? = prefs(context).getString("payload", null)
    fun payload(context: Context, value: String) { prefs(context).edit().putString("payload", value).commit() }

    @Synchronized fun schedule(context: Context, eventId: String, deadline: Long, revision: Long): String {
        val token = "$eventId:$revision:$deadline"
        val store = prefs(context)
        val tokens = (store.getStringSet("tokens", emptySet()) ?: emptySet()).toMutableSet()
        val edit = store.edit()
        if (!tokens.contains(token)) {
            while (tokens.size >= 64) { val old = tokens.minByOrNull { it.substringAfterLast(":").toLongOrNull() ?: 0L } ?: break; tokens.remove(old); edit.remove("claimed:$old").remove("cancelled:$old") }
            tokens.add(token)
        }
        edit.putBoolean("cancelled:$token", false).putStringSet("tokens", tokens).putString("active", token).putString("eventId", eventId).putLong("deadline", deadline).putLong("revision", revision).commit()
        return token
    }

    @Synchronized fun supersedeCancelled(context: Context, eventId: String, deadline: Long, revision: Long) {
        prefs(context).edit().putString("eventId", eventId).putLong("deadline", deadline).putLong("revision", revision).putBoolean("cancelled:$eventId:$revision:$deadline", true).remove("active").commit()
    }

    @Synchronized fun pending(context: Context, expectedId: String?, expectedRevision: Long?): String? {
        val store = prefs(context)
        if (expectedId != null && store.getString("eventId", null) != expectedId) return null
        if (expectedRevision != null && store.getLong("revision", 0) != expectedRevision) return null
        if (store.getLong("deadline", 0) <= System.currentTimeMillis()) return null
        val token = store.getString("active", null) ?: return null
        store.edit().putBoolean("cancelled:$token", true).remove("active").commit()
        return token
    }

    @Synchronized fun claim(context: Context, token: String): Boolean {
        val store = prefs(context)
        val deadline = token.substringAfterLast(":").toLongOrNull() ?: return false
        val now = System.currentTimeMillis()
        if (now < deadline || now > deadline + 5000L) return false
        if (store.getBoolean("claimed:$token", false) || store.getBoolean("cancelled:$token", false) || !(store.getStringSet("tokens", emptySet()) ?: emptySet()).contains(token)) return false
        return store.edit().putBoolean("claimed:$token", true).commit()
    }
}
