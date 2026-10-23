package com.devfit.app.timer

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.devfit.app.MainActivity
import com.devfit.app.R

class TimerNotificationPublisher : BroadcastReceiver() {
    private var mediaPlayer: MediaPlayer? = null
    private var audioFocusRequest: AudioFocusRequest? = null

    override fun onReceive(context: Context, intent: Intent) {
        val token = intent.getStringExtra("restToken")
        if (token != null && !RestCueStore.claim(context, token)) return
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val ignoreDoNotDisturb = intent.getBooleanExtra("ignoreDoNotDisturb", false)
        val vibration = intent.getBooleanExtra("vibration", false)
        val volume = intent.getFloatExtra("volume", 1.0f)

        val mayCue = ignoreDoNotDisturb || notificationManager.currentInterruptionFilter == NotificationManager.INTERRUPTION_FILTER_ALL

        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "Liftosaur::NotificationWakeLock"
        )
        wakeLock.acquire(5000)

        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        if (volume > 0 && mayCue) requestAudioFocus(audioManager)

        val notificationId = intent.getIntExtra("notificationId", Notification.REST_TIMER_ID)
        val activityIntent = Intent(context, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            activityIntent,
            PendingIntent.FLAG_CANCEL_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val title = intent.getStringExtra("title") ?: "Liftosaur"
        val subtitle = intent.getStringExtra("subtitle")
        val body = intent.getStringExtra("body")
        val channelId = if (ignoreDoNotDisturb) LiftosaurTimerModule.CHANNEL_ID_DND else LiftosaurTimerModule.CHANNEL_ID

        val notification = NotificationCompat.Builder(context, channelId)
            .setContentTitle(subtitle)
            .setContentText(body)
            .setContentInfo(title)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setDefaults(NotificationCompat.DEFAULT_LIGHTS)
            .build()

        if (volume > 0 && mayCue) playCustomSound(context, ignoreDoNotDisturb, volume)
        if (vibration && mayCue) triggerVibration(context)

        NotificationManagerCompat.from(context).notify(notificationId, notification)

        Handler(Looper.getMainLooper()).postDelayed({
            try {
                if (volume > 0) {
                    releaseAudioFocus(audioManager)
                    stopAlarmSound()
                }
            } catch (_: Exception) {}
            wakeLock.release()
        }, 4000)
    }

    private fun playCustomSound(context: Context, ignoreDoNotDisturb: Boolean, volume: Float) {
        try {
            mediaPlayer?.release()
            mediaPlayer = MediaPlayer().apply {
                val attrs = AudioAttributes.Builder()
                    .setUsage(if (ignoreDoNotDisturb) AudioAttributes.USAGE_ALARM else AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
                setAudioAttributes(attrs)
                context.resources.openRawResourceFd(R.raw.notif).use { afd -> setDataSource(afd.fileDescriptor, afd.startOffset, afd.length) }
                prepare()
                isLooping = false
                setVolume(volume, volume)
                start()
            }
        } catch (e: Exception) {
            try {
                val defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                mediaPlayer = MediaPlayer().apply {
                    val attrs = AudioAttributes.Builder()
                        .setUsage(if (ignoreDoNotDisturb) AudioAttributes.USAGE_ALARM else AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                    setAudioAttributes(attrs)
                    setDataSource(context, defaultSound)
                    prepare()
                    setVolume(volume, volume)
                    start()
                }
            } catch (_: Exception) {}
        }
    }

    private fun stopAlarmSound() {
        try {
            mediaPlayer?.stop()
            mediaPlayer?.release()
        } catch (_: Exception) {}
        mediaPlayer = null
    }

    private fun requestAudioFocus(audioManager: AudioManager) {
        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(attrs)
                .setAcceptsDelayedFocusGain(false)
                .setOnAudioFocusChangeListener {}
                .build()
            audioFocusRequest?.let { audioManager.requestAudioFocus(it) }
        } else {
            @Suppress("DEPRECATION")
            audioManager.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
        }
    }

    private fun releaseAudioFocus(audioManager: AudioManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
        } else {
            @Suppress("DEPRECATION")
            audioManager.abandonAudioFocus(null)
        }
        audioFocusRequest = null
    }

    private fun triggerVibration(context: Context) {
        val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        if (!vibrator.hasVibrator()) return
        val pattern = longArrayOf(0, 1000, 500, 1000, 500, 1000)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(pattern, -1)
        }
    }
}
