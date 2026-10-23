package com.devfit.app.eventreporter

object LastTerminationHolder {
    @Volatile
    private var info: EventReporterTombstone.Info? = null

    @Synchronized
    fun set(value: EventReporterTombstone.Info?) {
        info = value
    }

    @Synchronized
    fun consume(): EventReporterTombstone.Info? {
        val v = info
        info = null
        return v
    }
}
