package com.devfit.app.push

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.devfit.app.specs.NativeLiftosaurPushSpec

class LiftosaurPushModule(reactContext: ReactApplicationContext) :
    NativeLiftosaurPushSpec(reactContext) {

    init {
        PushDispatcher.setModule(this)
    }

    override fun start(promise: Promise) {
        promise.resolve(null)
    }

    override fun flushPending(promise: Promise) {
        PushDispatcher.flushPending()
        promise.resolve(null)
    }

    override fun complete(deliveryId: String, newData: Boolean, promise: Promise) {
        promise.resolve(null)
    }

    fun dispatchToken(event: WritableMap) {
        emitOnToken(event)
    }

    fun dispatchPush(event: WritableMap) {
        emitOnPush(event)
    }

    override fun invalidate() {
        PushDispatcher.setModule(null)
        super.invalidate()
    }
}
